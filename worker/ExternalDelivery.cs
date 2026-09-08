using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Npgsql;
namespace Relay.Worker;
public sealed partial class ImportWorker
{
    readonly HttpClient destinationClient=new(){Timeout=TimeSpan.FromSeconds(15)};
    sealed record Delivery(string Key,int Row,JsonElement Payload,string State,int Attempts);
    async Task<JsonDocument> DestinationRequest(string path,object body,CancellationToken ct)
    {
        var endpoint=config["Relay:ConnectorUrl"]??"http://127.0.0.1:4321";
        var key=config["Relay:ConnectorKey"]??(Environment.GetEnvironmentVariable("RELAY_DEMO_MODE")=="true"?"relay-local-connector":null);
        if(string.IsNullOrEmpty(key))throw new InvalidDataException("External destination credentials are not configured.");
        using var request=new HttpRequestMessage(HttpMethod.Post,endpoint.TrimEnd('/')+path);
        request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",key);
        if(Activity.Current?.Id is string trace)request.Headers.TryAddWithoutValidation("traceparent",trace);
        request.Content=new StringContent(Json(body),Encoding.UTF8,"application/json");
        using var response=await destinationClient.SendAsync(request,ct);
        if(response.StatusCode==HttpStatusCode.TooManyRequests)throw new Throttled((int)Math.Clamp(response.Headers.RetryAfter?.Delta?.TotalSeconds??2,1,60));
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
    }
    sealed class Throttled(int seconds):Exception {public int Seconds {get;}=seconds;}
    async Task Deliver(NpgsqlConnection c,Job snapshot,CancellationToken ct)
    {
        var job=snapshot;
        var end=Math.Min(job.Total,job.Committed+batchSize);
        await using(var tx=await c.BeginTransactionAsync(ct)) {
            job=(await Load(c,job.Id,tx,true))!;
            if(job.Status is not ("queued" or "running" or "paused" or "cancelled"))return;
            if(job.Approved!=Approval(job))throw new InvalidDataException("Approval no longer matches the destination contract.");
            end=Math.Min(job.Total,job.Committed+batchSize);
            if(job.Status is "queued" or "running") {
                await Exec(c,tx,"""
                    INSERT INTO delivery_outbox(org_id,job_id,row_no,idempotency_key,payload)
                    SELECT org_id,job_id,row_no,job_id::text||':'||$4::text||':'||row_no::text,normalized
                    FROM import_rows WHERE job_id=$1 AND row_no>$2 AND row_no<=$3 AND disposition IN ('ready','existing','conflict') AND NOT committed
                    ON CONFLICT DO NOTHING
                    """,job.Id,job.Committed,end,job.Version);
                await Exec(c,tx,"UPDATE jobs SET status='running',updated_at=now() WHERE id=$1",job.Id);
            }
            await tx.CommitAsync(ct);
        }
        var items=new List<Delivery>();
        await using(var cmd=new NpgsqlCommand("SELECT idempotency_key,row_no,payload::text,state,attempts FROM delivery_outbox WHERE job_id=$1 AND state IN ('pending','uncertain') AND row_no>$2 AND row_no<=$3 ORDER BY row_no",c)) {
            cmd.Parameters.AddWithValue(job.Id);cmd.Parameters.AddWithValue(job.Committed);cmd.Parameters.AddWithValue(end);
            await using var r=await cmd.ExecuteReaderAsync(ct);
            while(await r.ReadAsync(ct))items.Add(new(r.GetString(0),r.GetInt32(1),JsonSerializer.Deserialize<JsonElement>(r.GetString(2)),r.GetString(3),r.GetInt32(4)));
        }
        try {
            var outcomes=new Dictionary<string,string>();
            if(items.Count>0) {
                // Receipt lookup also recovers the commit/response-loss window after a real process restart.
                using var known=await DestinationRequest("/v1/receipts",new{tenantId=job.Org,keys=items.Select(i=>i.Key)},ct);
                ReadReceipts(known,outcomes,items);
                var missing=items.Where(i=>!outcomes.ContainsKey(i.Key)).ToArray();
                // Serialize the permission-to-send decision with pause/cancel. Mark uncertainty before network I/O.
                bool send=false;
                await using(var tx=await c.BeginTransactionAsync(ct)) {
                    var current=(await Load(c,job.Id,tx,true))!;
                    send=current.Status is "queued" or "running";
                    if(send && missing.Length>0) await Exec(c,tx,"UPDATE delivery_outbox SET state='uncertain',attempts=attempts+1,updated_at=now() WHERE job_id=$1 AND idempotency_key=ANY($2)",job.Id,missing.Select(i=>i.Key).ToArray());
                    await tx.CommitAsync(ct);
                }
                if(send && missing.Length>0) {
                    using var delivered=await DestinationRequest("/v1/batches",new{tenantId=job.Org,items=missing.Select(i=>new{key=i.Key,payload=i.Payload})},ct);
                    ReadReceipts(delivered,outcomes,items);
                }
            }
            await using var final=await c.BeginTransactionAsync(ct);
            var latest=(await Load(c,job.Id,final,true))!;
            foreach(var pair in outcomes) {
                await Exec(c,final,"""
                    UPDATE delivery_outbox SET state='delivered',outcome=$3,last_error=NULL,updated_at=now() WHERE job_id=$1 AND idempotency_key=$2
                    """,job.Id,pair.Key,pair.Value);
                await Exec(c,final,"""
                    UPDATE import_rows r SET committed=true,disposition=$3,errors=CASE WHEN $3='conflict' THEN '["Destination values differ. Existing contact was preserved."]'::jsonb ELSE '[]'::jsonb END
                    FROM delivery_outbox o WHERE o.job_id=$1 AND o.idempotency_key=$2 AND r.job_id=o.job_id AND r.row_no=o.row_no
                    """,job.Id,pair.Key,pair.Value);
            }
            var active=latest.Status is "queued" or "running";
            if(active)await Exec(c,final,"UPDATE import_rows SET committed=true WHERE job_id=$1 AND row_no>$2 AND row_no<=$3 AND disposition IN ('rejected','duplicate')",job.Id,job.Committed,end);
            else await Exec(c,final,"UPDATE delivery_outbox SET state='abandoned' WHERE job_id=$1 AND state='pending' AND attempts=0",job.Id);
            var first=await Scalar<int>(c,final,"SELECT coalesce(min(row_no),$3+1) FROM import_rows WHERE job_id=$1 AND row_no>$2 AND row_no<=$3 AND NOT committed",job.Id,job.Committed,end);
            var checkpoint=first-1;
            var done=checkpoint>=job.Total;
            var unresolved=await Scalar<long>(c,final,"SELECT count(*) FROM delivery_outbox WHERE job_id=$1 AND state='uncertain'",job.Id);
            await Exec(c,final,"UPDATE jobs SET commit_checkpoint=$2,status=$3,attempts=0,last_error=$4,next_attempt_at=now()+interval '2 seconds',updated_at=now() WHERE id=$1",job.Id,checkpoint,active?(done?"completed":"running"):latest.Status,unresolved>0?"Some destination outcomes remain uncertain; receipt reconciliation is pending.":null);
            if(!active && unresolved>0)await Exec(c,final,"UPDATE delivery_outbox SET attempts=attempts+1 WHERE job_id=$1 AND state='uncertain'",job.Id);
            if(done&&active)await Event(c,final,job.Org,job.Id,"completed",$"External delivery complete. All {job.Total:N0} rows accounted for using durable receipts.");
            await final.CommitAsync(ct);
        } catch(OperationCanceledException) when(ct.IsCancellationRequested){throw;}
        catch(Exception error) {
            logger.LogWarning("External job {JobId}: {ErrorType} at {Stack}",job.Id,error.GetType().Name,error.StackTrace);
            await using var tx=await c.BeginTransactionAsync(ct);
            var seconds=error is Throttled rate?rate.Seconds:2;
            var message=error is Throttled?"Destination rate limited this batch. Retrying after Retry-After.":"Destination outcome is uncertain. Checking receipts before any retry.";
            await Exec(c,tx,"UPDATE delivery_outbox SET last_error=$2,attempts=attempts+1,updated_at=now() WHERE job_id=$1 AND state IN ('pending','uncertain')",job.Id,message);
            await Exec(c,tx,"""
                UPDATE jobs SET last_error=$2,attempts=attempts+1,suspended_status=CASE WHEN status IN ('running','queued') THEN status ELSE suspended_status END,
                status=CASE WHEN attempts+1>=5 AND status IN ('queued','running') THEN 'failed' ELSE status END,
                next_attempt_at=now()+make_interval(secs=>$3),updated_at=now() WHERE id=$1
                """,job.Id,message,seconds);
            await Event(c,tx,job.Org,job.Id,error is Throttled?"throttled":"uncertain",message);
            await tx.CommitAsync(ct);
            if(error is not Throttled && config.GetValue("Relay:CrashOnUncertain",false))Environment.Exit(75);
        }
    }
    static void ReadReceipts(JsonDocument response,Dictionary<string,string> outcomes,List<Delivery> items)
    {
        foreach(var r in response.RootElement.GetProperty("receipts").EnumerateArray()) {
            var key=r.GetProperty("key").GetString()!;var outcome=r.GetProperty("outcome").GetString()!;
            if(!items.Any(i=>i.Key==key)||outcome is not ("imported" or "existing" or "conflict"))throw new InvalidDataException("Destination returned an invalid receipt.");
            outcomes[key]=outcome;
        }
    }
}