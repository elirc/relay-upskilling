using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using Npgsql;
using NpgsqlTypes;
namespace Relay.Worker;

public sealed partial class ImportWorker(NpgsqlDataSource source,IConfiguration config,ILogger<ImportWorker> logger) : BackgroundService
{
    readonly int batchSize = Math.Clamp(config.GetValue("Relay:BatchSize",500),1,2000);
    readonly int delayMs = Math.Clamp(config.GetValue("Relay:BatchDelayMs",0),0,10000);
    readonly int crashAfter = config.GetValue("Relay:CrashAfterRows",0);
    readonly string uploadDir = Path.GetFullPath(config["Relay:UploadDir"] ?? ".data/uploads");
    const int MaxAttempts=5;
    readonly Guid workerId=Guid.NewGuid();
    readonly Dictionary<Guid,SourceCursor> cursors=new();
    static readonly System.Diagnostics.ActivitySource Traces=new("Relay.Worker");
    static readonly System.Diagnostics.Metrics.Meter Meter=new("Relay.Worker","0.2.0");
    static readonly System.Diagnostics.Metrics.Counter<long> RowsMetric=Meter.CreateCounter<long>("relay.rows.processed");
    static readonly System.Diagnostics.Metrics.Histogram<double> DurationMetric=Meter.CreateHistogram<double>("relay.batch.duration","ms");
    static string Approval(Job j)=>Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(j.ApprovalFormat==1?$"{j.Hash}:{j.Version}:{j.Schema}":$"{j.Hash}:{j.Version}:{j.Schema}:{j.SchemaHash}:{j.Destination}")));
    void DropCursor(Guid id){if(cursors.Remove(id,out var cursor))cursor.Dispose();}
    static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    static string Json<T>(T value) => JsonSerializer.Serialize(value,JsonOptions);
    static Dictionary<string,string> Dict(string json) => JsonSerializer.Deserialize<Dictionary<string,string>>(json) ?? new();
    static async Task<int> Exec(NpgsqlConnection c,NpgsqlTransaction? tx,string sql,params object?[] args)
    {
        await using var cmd=new NpgsqlCommand(sql,c,tx);
        foreach(var arg in args) cmd.Parameters.Add(new NpgsqlParameter {Value=arg??DBNull.Value});
        return await cmd.ExecuteNonQueryAsync();
    }
    static async Task<T?> Scalar<T>(NpgsqlConnection c,NpgsqlTransaction? tx,string sql,params object?[] args)
    {
        await using var cmd=new NpgsqlCommand(sql,c,tx);
        foreach(var arg in args) cmd.Parameters.Add(new NpgsqlParameter {Value=arg??DBNull.Value});
        var value=await cmd.ExecuteScalarAsync();
        return value is null || value is DBNull ? default : (T)value;
    }
    static Task<int> Event(NpgsqlConnection c,NpgsqlTransaction? tx,Guid org,Guid id,string kind,string message) =>
        Exec(c,tx,"INSERT INTO job_events(org_id,job_id,kind,message) VALUES($1,$2,$3,$4)",org,id,kind,message);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Relay worker started. Batch size {BatchSize}",batchSize);
        while(!stoppingToken.IsCancellationRequested) {
            try {
                await using var connection=await source.OpenConnectionAsync(stoppingToken);
                await Exec(connection,null,"INSERT INTO worker_heartbeats(id,version,schemas,memory_bytes,last_seen) VALUES($1,'0.2.0',$2,$3,now()) ON CONFLICT(id) DO UPDATE SET last_seen=now(),memory_bytes=$3",workerId,SchemaRegistry.Versions.Where(v=>v<=config.GetValue("Relay:MaxSchema",2)).ToArray(),System.Diagnostics.Process.GetCurrentProcess().WorkingSet64);
                foreach(var stale in cursors.Where(x=>x.Value.LastUsed<DateTime.UtcNow.AddMinutes(-2)).Select(x=>x.Key).ToArray()) DropCursor(stale);
                var candidates=new List<(Guid Id,Guid Org)>();
                await using(var cmd=new NpgsqlCommand("""
                    SELECT id,org_id FROM (
                        SELECT DISTINCT ON(org_id) id,org_id,updated_at FROM jobs j
                        WHERE (status IN ('parsing','validating','queued','running') OR
                          (status IN ('paused','cancelled') AND EXISTS(SELECT 1 FROM delivery_outbox o WHERE o.job_id=j.id AND o.state='uncertain' AND o.attempts<5)))
                          AND next_attempt_at<=now() AND schema_version<=$1
                        ORDER BY org_id,updated_at,id
                    ) fair ORDER BY updated_at,id LIMIT 32
                    """,connection))
                {cmd.Parameters.AddWithValue(config.GetValue("Relay:MaxSchema",2));
                await using var reader=await cmd.ExecuteReaderAsync(stoppingToken);
                    while(await reader.ReadAsync(stoppingToken)) candidates.Add((reader.GetGuid(0),reader.GetGuid(1)));}
                var worked=false;
                foreach(var (id,tenant) in candidates) {
                    if(stoppingToken.IsCancellationRequested) break;
                    // Session advisory lock is released by PostgreSQL when a crashed worker disconnects.
                    if(!await Scalar<bool>(connection,null,"SELECT pg_try_advisory_lock(hashtextextended($1::text,0))","tenant:"+tenant)) continue;
                    if(!await Scalar<bool>(connection,null,"SELECT pg_try_advisory_lock(hashtextextended($1::text,0))",id.ToString())) {await Scalar<bool>(connection,null,"SELECT pg_advisory_unlock(hashtextextended($1::text,0))","tenant:"+tenant);continue;}
                    try {
                        var job=await Load(connection,id);
                        if(job is null) continue;
                        if(job.Schema>config.GetValue("Relay:MaxSchema",2)) continue;
                        if(job.ApprovalFormat==2 && job.SchemaHash!=SchemaRegistry.Digest(job.Schema)) throw new InvalidDataException("Destination contract fingerprint changed.");
                        var watch=System.Diagnostics.Stopwatch.StartNew();
                        using var activity=Traces.StartActivity("import.batch",System.Diagnostics.ActivityKind.Internal) ?? new System.Diagnostics.Activity("import.batch").Start();
                        activity.SetTag("relay.job",id.ToString());
                        switch(job.Status) {
                            case "parsing": await Parse(connection,job,stoppingToken); worked=true; break;
                            case "validating": await Validate(connection,job,stoppingToken); worked=true; break;
                            case "queued": case "running": if(job.Destination=="test-api") await Deliver(connection,job,stoppingToken);else await Commit(connection,job,stoppingToken);worked=true;break;
                            case "paused":case "cancelled": await Deliver(connection,job,stoppingToken);worked=true;break;
                        }
                        var after=await Load(connection,id);
                        var beforeCount=job.Status=="parsing"?job.Parsed:job.Status=="validating"?job.Validated:job.Committed;
                        var afterCount=job.Status=="parsing"?after!.Parsed:job.Status=="validating"?after!.Validated:after!.Committed;
                        var count=Math.Max(0,afterCount-beforeCount);
                        RowsMetric.Add(count);DurationMetric.Record(watch.Elapsed.TotalMilliseconds);
                        await Exec(connection,null,"INSERT INTO batch_metrics(org_id,job_id,worker_id,phase,rows_processed,duration_ms,memory_bytes,checkpoint,trace_id,span_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",tenant,id,workerId,job.Status,count,watch.Elapsed.TotalMilliseconds,System.Diagnostics.Process.GetCurrentProcess().WorkingSet64,afterCount,activity.TraceId.ToString(),activity.SpanId.ToString());
                        if(after!.Status!="parsing") DropCursor(id);
                    } catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested) { break; }
                    catch(Exception error) {
                        DropCursor(id);
                        logger.LogError("Job {JobId} failed: {ErrorType}. {Stack}",id,error.GetType().Name,error.StackTrace);
                        await using var tx=await connection.BeginTransactionAsync(stoppingToken);
                        // Do not revive an operator-cancelled or paused job.
                        await Exec(connection,tx,"""
                            UPDATE jobs SET attempts=attempts+1,last_error=$2,suspended_status=status,
                            status=CASE WHEN attempts+1 >= $3 THEN 'failed' ELSE status END,
                            next_attempt_at=now()+make_interval(secs => LEAST(60,power(2,attempts+1)::int)),
                            updated_at=now() WHERE id=$1 AND status IN ('parsing','validating','queued','running')
                            """,id,PublicError(error),MaxAttempts);
                        var org=await Scalar<Guid>(connection,tx,"SELECT org_id FROM jobs WHERE id=$1",id);
                        await Event(connection,tx,org,id,"retry","Processing interrupted. Retry scheduled with bounded backoff; after five failures the import needs attention.");
                        await tx.CommitAsync(stoppingToken);
                    } finally {
                        await Scalar<bool>(connection,null,"SELECT pg_advisory_unlock(hashtextextended($1::text,0))",id.ToString());
                        await Scalar<bool>(connection,null,"SELECT pg_advisory_unlock(hashtextextended($1::text,0))","tenant:"+tenant);
                    }
                }
                await Task.Delay(worked?Math.Max(delayMs,10):750,stoppingToken);
            } catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested) { break; }
            catch(Exception error) {
                logger.LogError(error,"Worker connection failed; reconnecting");
                await Task.Delay(3000,stoppingToken);
            }
        }
    }
    static string PublicError(Exception error) => error is InvalidDataException ? error.Message
        : error is CsvHelperException ? "CSV could not be parsed. Check quotes, column counts, and UTF-8 encoding."
        : "Processing failed. See worker logs using this import ID.";

    sealed record Job(Guid Id,Guid Org,string Status,string Key,string Hash,Dictionary<string,string> Mapping,int Version,int Schema,int Parsed,int Validated,int Committed,int Total,string? Approved,bool CrashInjected,string? SchemaHash,int ApprovalFormat,string Destination,Dictionary<string,string> Transforms,string Format);
    static async Task<Job?> Load(NpgsqlConnection c,Guid id,NpgsqlTransaction? tx=null,bool locked=false)
    {
        await using var cmd=new NpgsqlCommand("SELECT id,org_id,status,file_key,file_hash,mapping::text,mapping_version,schema_version,parse_checkpoint,validation_checkpoint,commit_checkpoint,total_rows,approved_hash,crash_injected,schema_hash,approval_format,destination,transformations::text,file_format FROM jobs WHERE id=$1"+(locked?" FOR UPDATE":""),c,tx);
        cmd.Parameters.AddWithValue(id);
        await using var r=await cmd.ExecuteReaderAsync();
        if(!await r.ReadAsync()) return null;
        return new Job(r.GetGuid(0),r.GetGuid(1),r.GetString(2),r.GetString(3),r.GetString(4),Dict(r.GetString(5)),r.GetInt32(6),r.GetInt32(7),r.GetInt32(8),r.GetInt32(9),r.GetInt32(10),r.GetInt32(11),r.IsDBNull(12)?null:r.GetString(12),r.GetBoolean(13),r.IsDBNull(14)?null:r.GetString(14),r.GetInt32(15),r.GetString(16),Dict(r.GetString(17)),r.GetString(18));
    }
    async Task Parse(NpgsqlConnection c,Job job,CancellationToken ct)
    {
        var path=Path.GetFullPath(Path.Combine(uploadDir,job.Key));
        if(!path.StartsWith(uploadDir+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Invalid file location.");
        if(cursors.TryGetValue(job.Id,out var cached) && cached.Position!=job.Parsed) DropCursor(job.Id);
        if(!cursors.TryGetValue(job.Id,out var cursor)) {
            if(cursors.Count>=8) DropCursor(cursors.MinBy(x=>x.Value.LastUsed).Key);
            cursor=new SourceCursor(path,job.Hash,job.Format,job.Parsed);cursors[job.Id]=cursor;
            var mapping=ContactRules.Suggest(cursor.Headers).Where(x=>SchemaRegistry.Fields(job.Schema).Contains(x.Key)).ToDictionary();
            await Exec(c,null,"UPDATE jobs SET headers=$2::jsonb,mapping=CASE WHEN mapping_version=0 THEN $3::jsonb ELSE mapping END WHERE id=$1",job.Id,Json(cursor.Headers),Json(mapping));
        }
        var batch=new List<(int Row,string Raw)>();bool ended=false;
        for(var i=0;i<batchSize;i++) {ct.ThrowIfCancellationRequested();var raw=cursor.Read();if(raw==null){ended=true;break;}batch.Add((cursor.Position,Json(raw)));}
        if(batch.Count>0 && !await SaveParsed(c,job,batch,ct)) {DropCursor(job.Id);return;}
        if(!ended)return;
        var row=cursor.Position;DropCursor(job.Id);
        await using var tx=await c.BeginTransactionAsync(ct);
        var current=await Load(c,job.Id,tx,true);
        if(current?.Status!="parsing")return;
        if(row==0)throw new InvalidDataException("File has a header but no contact records.");
        await Exec(c,tx,"UPDATE jobs SET status='mapping',total_rows=$2,attempts=0,last_error=NULL,updated_at=now() WHERE id=$1",job.Id,row);
        await Event(c,tx,job.Org,job.Id,"parsed",$"Read {row:N0} records. Confirm the suggested column mapping.");
        await tx.CommitAsync(ct);
    }
    static async Task<bool> SaveParsed(NpgsqlConnection c,Job job,List<(int Row,string Raw)> rows,CancellationToken ct)
    {
        await using var tx=await c.BeginTransactionAsync(ct);
        var current=await Load(c,job.Id,tx,true);
        if(current?.Status!="parsing") return false;
        await using(var batch=new NpgsqlBatch(c,tx)) {
            foreach(var row in rows) {
                var cmd=new NpgsqlBatchCommand("INSERT INTO import_rows(org_id,job_id,row_no,raw) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING");
                cmd.Parameters.AddWithValue(job.Org);cmd.Parameters.AddWithValue(job.Id);cmd.Parameters.AddWithValue(row.Row);cmd.Parameters.AddWithValue(row.Raw);batch.BatchCommands.Add(cmd);
            }
            await batch.ExecuteNonQueryAsync(ct);
        }
        await Exec(c,tx,"UPDATE jobs SET parse_checkpoint=$2,total_rows=$2,updated_at=now() WHERE id=$1",job.Id,rows[^1].Row);
        await tx.CommitAsync(ct);return true;
    }

    async Task Validate(NpgsqlConnection c,Job job,CancellationToken ct)
    {
        await using var tx=await c.BeginTransactionAsync(ct);
        var current=await Load(c,job.Id,tx,true);
        if(current?.Status!="validating") return;
        var rows=new List<(int Row,Dictionary<string,string> Raw)>();
        await using(var cmd=new NpgsqlCommand("SELECT row_no,raw::text FROM import_rows WHERE job_id=$1 AND row_no>$2 ORDER BY row_no LIMIT $3",c,tx)) {
            cmd.Parameters.AddWithValue(job.Id);cmd.Parameters.AddWithValue(current.Validated);cmd.Parameters.AddWithValue(batchSize);
            await using var r=await cmd.ExecuteReaderAsync(ct);
            while(await r.ReadAsync(ct)) rows.Add((r.GetInt32(0),Dict(r.GetString(1))));
        }
        // Normalize in C#; ship a bounded batch once instead of making multiple round trips per row.
        var payload=rows.Select(row=>{
            var(data,errors)=ContactRules.Normalize(row.Raw,current.Mapping,current.Schema,current.Transforms);
            return new {row_no=row.Row,data,errors};
        }).ToArray();
        var checkpoint=rows.Count==0?current.Validated:rows[^1].Row;
        if(rows.Count>0) {
            await Exec(c,tx,"""
                UPDATE import_rows r SET normalized=n.data,email=n.data->>'email',
                    disposition=CASE WHEN jsonb_array_length(n.errors)>0 THEN 'rejected' ELSE 'ready' END,
                    errors=n.errors,committed=false
                FROM jsonb_to_recordset($2::jsonb) AS n(row_no int,data jsonb,errors jsonb)
                WHERE r.job_id=$1 AND r.row_no=n.row_no
                """,job.Id,Json(payload));
            // Earlier rows were normalized in this version; all rows in this batch were reset above.
            await Exec(c,tx,"""
                UPDATE import_rows r SET disposition='duplicate'
                WHERE r.job_id=$1 AND r.row_no>$2 AND r.row_no<=$3 AND r.disposition='ready'
                AND EXISTS(SELECT 1 FROM import_rows earlier WHERE earlier.job_id=r.job_id
                    AND earlier.email=r.email AND earlier.row_no<r.row_no AND earlier.disposition<>'rejected')
                """,job.Id,current.Validated,checkpoint);
            await Exec(c,tx,"""
                UPDATE import_rows r SET
                    disposition=CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.normalized) f WHERE coalesce(c.data->>f.key,'')<>f.value) THEN 'existing' ELSE 'conflict' END,
                    errors=CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.normalized) f WHERE coalesce(c.data->>f.key,'')<>f.value) THEN '[]'::jsonb
                        ELSE '["This email already exists with different values. Existing contact will be preserved."]'::jsonb END
                FROM contacts c WHERE r.job_id=$1 AND r.row_no>$2 AND r.row_no<=$3 AND r.disposition='ready'
                    AND c.org_id=r.org_id AND c.email=r.email AND $4='local'
                """,job.Id,current.Validated,checkpoint,current.Destination);
        }
        var done=checkpoint>=current.Total;
        await Exec(c,tx,"UPDATE jobs SET validation_checkpoint=$2,status=$3,attempts=0,last_error=NULL,updated_at=now() WHERE id=$1",job.Id,checkpoint,done?"review":"validating");
        if(done) await Event(c,tx,job.Org,job.Id,"validated","Validation complete. Review rejected rows, duplicates and conflicts before approval.");
        await tx.CommitAsync(ct);
    }
    async Task Commit(NpgsqlConnection c,Job job,CancellationToken ct)
    {
        var crashBefore=config.GetValue("Relay:CrashBeforeRows",0);
        var injectBefore=crashBefore>0 && job.Committed+batchSize>=crashBefore && await Exec(c,null,"UPDATE jobs SET crash_before_injected=true WHERE id=$1 AND NOT crash_before_injected",job.Id)>0;
        await using var tx=await c.BeginTransactionAsync(ct);
        var current=await Load(c,job.Id,tx,true);
        if(current is null || current.Status is not ("queued" or "running")) return;
        var expected=Approval(current);
        if(current.Approved!=expected) throw new InvalidDataException("Approval does not match the current file and mapping.");
        var checkpoint=Math.Min(current.Total,current.Committed+batchSize);
        if(current.Status=="queued") await Event(c,tx,job.Org,job.Id,"started",$"Processing from committed row {current.Committed:N0}.");
        // Destination uniqueness is the final arbiter, even if another job committed after preview.
        await Exec(c,tx,"""
            WITH inserted AS (
                INSERT INTO contacts(id,org_id,email,data,source_job_id,source_row_no)
                SELECT gen_random_uuid(),org_id,email,normalized,job_id,row_no FROM import_rows
                WHERE job_id=$1 AND row_no>$2 AND row_no<=$3 AND disposition IN ('ready','existing','conflict')
                ORDER BY email ON CONFLICT(org_id,email) DO NOTHING RETURNING source_row_no
            )
            UPDATE import_rows SET disposition='imported'
            WHERE job_id=$1 AND row_no IN (SELECT source_row_no FROM inserted)
            """,job.Id,current.Committed,checkpoint);
        await Exec(c,tx,"""
            SELECT c.email FROM contacts c JOIN import_rows r ON c.org_id=r.org_id AND c.email=r.email
            WHERE r.job_id=$1 AND r.row_no>$2 AND r.row_no<=$3 AND r.disposition IN ('ready','existing','conflict')
            ORDER BY c.email FOR SHARE OF c
            """,job.Id,current.Committed,checkpoint);
        await Exec(c,tx,"""
            UPDATE import_rows r SET disposition=CASE
                WHEN NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.normalized) f WHERE coalesce(c.data->>f.key,'')<>f.value)
                    THEN 'existing' ELSE 'conflict' END
            FROM contacts c WHERE r.job_id=$1 AND r.row_no>$2 AND r.row_no<=$3
                AND r.disposition IN ('ready','existing','conflict') AND c.org_id=r.org_id AND c.email=r.email
            """,job.Id,current.Committed,checkpoint);
        await Exec(c,tx,"""
            UPDATE import_rows SET committed=true,errors=CASE
                WHEN disposition='conflict' THEN '["This email already exists with different values. Existing contact was preserved."]'::jsonb
                WHEN disposition IN ('imported','existing') THEN '[]'::jsonb ELSE errors END
            WHERE job_id=$1 AND row_no>$2 AND row_no<=$3
            """,job.Id,current.Committed,checkpoint);
        var done=checkpoint>=current.Total;
        var inject=crashAfter>0 && checkpoint>=crashAfter && !current.CrashInjected && !done;
        await Exec(c,tx,"UPDATE jobs SET commit_checkpoint=$2,status=$3,crash_injected=crash_injected OR $4,attempts=0,last_error=NULL,updated_at=now() WHERE id=$1",job.Id,checkpoint,done?"completed":"running",inject);
        if(inject) await Event(c,tx,job.Org,job.Id,"crash_rehearsal",$"Recovery rehearsal armed at committed row {checkpoint:N0}. Worker will exit immediately after this transaction.");
        if(done) await Event(c,tx,job.Org,job.Id,"completed",$"Import complete. All {current.Total:N0} rows have a final outcome.");
        if(injectBefore)Environment.Exit(74);
        await tx.CommitAsync(ct);
        logger.LogInformation("Job {JobId} committed checkpoint {Checkpoint}/{Total}",job.Id,checkpoint,current.Total);
        if(inject) Environment.Exit(73);
    }
}
