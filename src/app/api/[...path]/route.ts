import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { pool, transaction } from '@/lib/db';
import { authenticate, authorize, HttpError, signIn, tokenHash } from '@/lib/auth';
import { csvCell, mappingSchema, transformsSchema, fieldsFor, schemaVersions } from '@/lib/contracts';
import { platformPublic, platformPrivate } from '@/lib/platform-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const json = (value: unknown, status=200) => NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
const approvalHash = (job: Record<string,unknown>) => createHash('sha256').update(job.file_hash+':'+job.mapping_version+':'+job.schema_version+(job.approval_format===2?':'+job.schema_hash+':'+job.destination:'')).digest('hex');
async function event(client: {query: typeof pool.query}, org: string, id: string, kind:string, message:string) {
  await client.query('INSERT INTO job_events(org_id,job_id,kind,message) VALUES($1,$2,$3,$4)',[org,id,kind,message]);
}
async function handler(request: Request) {
  try {
    const url=new URL(request.url);
    const parts=url.pathname.slice(5).split('/').filter(Boolean);
    const method=request.method;
    if (!['GET','HEAD'].includes(method)) {
      const origin=request.headers.get('origin');
      if ((origin && new URL(origin).host !== (request.headers.get('host') ?? url.host)) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403,'Cross-site request rejected.');
    }
    const publicResponse=await platformPublic(request,parts);if(publicResponse)return publicResponse;
    if (parts[0] === 'login' && method==='POST') {
      const body=z.object({email:z.string().email().max(200),password:z.string().min(1).max(200)}).parse(await request.json());
      const token=await signIn(body.email.toLowerCase(),body.password);
      const response=json({ok:true});
      response.cookies.set('relay_session',token,{httpOnly:true,sameSite:'lax',secure:url.protocol==='https:',path:'/',maxAge:43200});
      return response;
    }
    if (parts[0] === 'session' && method==='GET') {
      const user=await authenticate(request);
      const {rows}=await pool.query('SELECT o.id,o.name,o.slug,m.role FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=$1 ORDER BY o.name',[user.id]);
      return json({user,organizations:rows,demo:process.env.RELAY_DEMO_MODE==='true'});
    }
    if (parts[0]==='logout' && method==='POST') {
      const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('relay_session='))?.slice(14);
      if(token) await pool.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(token)]);
      const response=json({ok:true}); response.cookies.delete('relay_session'); return response;
    }
    const {user,org,role}=await authorize(request,['approve','retry','reconcile'].includes(parts[2]));
    const platformResponse=await platformPrivate(request,parts,{user,org,role});if(platformResponse)return platformResponse;
    if (parts[0]==='overview' && method==='GET') {
      const {rows}=await pool.query(`SELECT j.*,COALESCE(c.counts,'{}') AS counts FROM jobs j LEFT JOIN LATERAL
        (SELECT jsonb_object_agg(disposition,n) AS counts FROM (SELECT disposition,count(*)::int n FROM import_rows WHERE job_id=j.id GROUP BY disposition) x) c ON true
        WHERE j.org_id=$1 ORDER BY j.created_at DESC LIMIT 100`,[org]);
      const {rows:contacts}=await pool.query('SELECT count(*)::int AS total FROM contacts WHERE org_id=$1',[org]);
      const {rows:remote}=await pool.query('SELECT count(*)::int AS total FROM test_destination_contacts WHERE org_id=$1',[org]);
      return json({jobs:rows,contacts:contacts[0].total,remoteContacts:remote[0].total});
    }
    if(parts[0]==='jobs' && parts.length===1 && method==='POST') {
      const fileName=basename(decodeURIComponent(request.headers.get('x-file-name')??'contacts.csv')).slice(0,180);
      const format=fileName.toLowerCase().endsWith('.xlsx')?'xlsx':fileName.toLowerCase().endsWith('.csv')?'csv':null;
      if(!format)throw new HttpError(400,'Please upload CSV or XLSX.');
      const schema=z.coerce.number().int().min(1).max(2).parse(request.headers.get('x-relay-schema')??1);
      const destination=z.enum(['local','test-api']).parse(request.headers.get('x-relay-destination')??'local');
      const {rows:[contract]}=await pool.query('SELECT digest FROM destination_schemas WHERE version=$1',[schema]);
      if(!contract)throw new HttpError(503,'Run database migrations before uploading.');
      if(!request.body) throw new HttpError(400,'The file is empty.');
      const id=randomUUID(), key=id+'.'+format, directory=resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR??'.data/uploads');
      await mkdir(directory,{recursive:true});
      const path=resolve(directory,key), hash=createHash('sha256'); let size=0;
      const meter=new Transform({transform(chunk,_,callback){size+=chunk.length; if(size>32*1024*1024) return callback(new HttpError(413,'Files must be smaller than 32 MB.')); hash.update(chunk); callback(null,chunk);}});
      try {
        await pipeline(Readable.fromWeb(request.body as never),meter,createWriteStream(path,{flags:'wx'}));
        if(!size) throw new HttpError(400,'The file is empty.');
        await transaction(async client=>{
          await client.query('INSERT INTO jobs(id,org_id,created_by,file_name,file_key,file_hash,file_bytes,schema_version,schema_hash,approval_format,destination,file_format) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,2,$10,$11)',[id,org,user.id,fileName,key,hash.digest('hex'),size,schema,contract.digest,destination,format]);
          await event(client,org,id,'uploaded','Original file stored. Waiting for a worker to read the file.');
        });
      } catch(error) { await unlink(path).catch(()=>{}); throw error; }
      return json({id},201);
    }
    if(parts[0]!=='jobs' || !parts[1]) throw new HttpError(404,'Not found.');
    const id=uuid.parse(parts[1]);
    const {rows:found}=await pool.query('SELECT * FROM jobs WHERE id=$1 AND org_id=$2',[id,org]);
    if(!found[0]) throw new HttpError(404,'Import not found.');
    if(parts.length===2 && method==='GET') {
      const {rows:counts}=await pool.query('SELECT disposition,count(*)::int AS count FROM import_rows WHERE job_id=$1 GROUP BY disposition',[id]);
      const {rows:events}=await pool.query('SELECT id,kind,message,created_at FROM job_events WHERE job_id=$1 AND org_id=$2 ORDER BY id DESC LIMIT 40',[id,org]);
      const {rows:delivery}=await pool.query('SELECT state,count(*)::int AS n FROM delivery_outbox WHERE job_id=$1 GROUP BY state',[id]);
      return json({job:{...found[0],delivery_counts:Object.fromEntries(delivery.map(d=>[d.state,d.n])),counts:Object.fromEntries(counts.map(c=>[c.disposition,c.count]))},events});
    }
    if(parts[2]==='suggest' && method==='POST') {
      if(!['mapping','review'].includes(found[0].status))throw new HttpError(409,'Wait for parsing or validation to finish.');
      const key=process.env.RELAY_AI_KEY??(process.env.RELAY_DEMO_MODE==='true'?'relay-local-ai':'');
      if(!key)throw new HttpError(503,'Mapping assistant is not configured.');
      let response:Response;
      try{response=await fetch((process.env.RELAY_AI_URL??'http://127.0.0.1:4319')+'/suggest',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({headers:found[0].headers,schemaVersion:found[0].schema_version}),signal:AbortSignal.timeout(120000)});}catch{throw new HttpError(503,'Mapping assistant unavailable. You can map columns manually.');}
      if(!response.ok)throw new HttpError(response.status===429?429:503,'Mapping assistant unavailable or busy. Try again shortly.');
      const proposal=z.object({model:z.string(),revision:z.string(),policy:z.string(),schemaVersion:z.number(),suggestions:z.array(z.object({field:z.string(),source:z.string().nullable(),method:z.enum(['alias','embedding','abstain']),score:z.number().nullable(),margin:z.number().nullable(),reason:z.string().max(300),transform:z.enum(['none','collapse_spaces','strip_phone_formatting'])})).max(5)}).parse(await response.json());
      const allowed=fieldsFor(found[0].schema_version).map(f=>f.key as string);
      if(proposal.schemaVersion!==found[0].schema_version||proposal.suggestions.some(s=>!allowed.includes(s.field)||(s.source!==null&&!found[0].headers.includes(s.source)))||new Set(proposal.suggestions.map(s=>s.field)).size!==proposal.suggestions.length)throw new HttpError(503,'Assistant returned an invalid proposal.');
      await pool.query('INSERT INTO mapping_suggestions(id,org_id,job_id,mapping_version,model,model_revision,result) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),org,id,found[0].mapping_version,proposal.model,proposal.revision,JSON.stringify(proposal)]);
      return json({...proposal,mappingVersion:found[0].mapping_version});
    }
    if(parts[2]==='rows' && method==='GET') {
      const after=z.coerce.number().int().min(0).parse(url.searchParams.get('after')??0);
      const filter=z.enum(['all','ready','rejected','duplicate','existing','conflict','imported','pending']).parse(url.searchParams.get('filter')??'all');
      const {rows}=await pool.query('SELECT row_no,raw,normalized,disposition,errors,committed FROM import_rows WHERE job_id=$1 AND org_id=$2 AND row_no>$3 AND ($4=\'all\' OR disposition=$4) ORDER BY row_no LIMIT 51',[id,org,after,filter]);
      return json({rows:rows.slice(0,50),hasMore:rows.length>50});
    }
    if(parts[2]==='report' && method==='GET') {
      const onlyErrors=url.searchParams.get('errors')==='true';
      const reportFields=fieldsFor(found[0].schema_version).map(f=>f.key);
      const encoder=new TextEncoder();
      let after=0, header=true, finished=false;
      const stream=new ReadableStream({async pull(controller){
        try {
          if(header){controller.enqueue(encoder.encode(['row','outcome','processed',...reportFields.map(f=>f==='joined_at'?'signup_date':f),'errors'].join(',')+'\r\n'));header=false;}
          if(finished){controller.close();return;}
          const {rows}=await pool.query("SELECT row_no,disposition,committed,raw,normalized,errors FROM import_rows WHERE job_id=$1 AND org_id=$2 AND row_no>$3 AND ($4=false OR disposition IN ('rejected','conflict')) ORDER BY row_no LIMIT 500",[id,org,after,onlyErrors]);
          if(!rows.length){finished=true;controller.close();return;}
          const text=rows.map(r=>{const n=r.normalized??{}; return [r.row_no,r.disposition,r.committed,...reportFields.map(f=>n[f]??r.raw[found[0].mapping[f]]),r.errors.join('; ')].map(csvCell).join(',');}).join('\r\n')+'\r\n';
          after=rows.at(-1).row_no; controller.enqueue(encoder.encode(text));
        }catch(error){controller.error(error);}
      }});
      return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="relay-'+id+'-'+(onlyErrors?'corrections':'report')+'.csv"','Cache-Control':'no-store'}});
    }
    if(method!=='POST') throw new HttpError(405,'Method not allowed.');
    const action=parts[2];
    await transaction(async client=>{
      const {rows}=await client.query('SELECT * FROM jobs WHERE id=$1 AND org_id=$2 FOR UPDATE',[id,org]);
      const job=rows[0]; if(!job) throw new HttpError(404,'Import not found.');
      if(action==='mapping' || action==='correct') {
        if(!['mapping','review'].includes(job.status)) throw new HttpError(409,'Wait for processing to finish before changing this import.');
        if(action==='mapping') {
          const body=await request.json();
          const mapping=mappingSchema.parse(body.mapping??body);
          const transforms=transformsSchema.parse(body.mapping?body.transformations??{}:{});
          const allowed=fieldsFor(job.schema_version).map(f=>f.key as string);
          if([...Object.keys(mapping),...Object.keys(transforms)].some(k=>!allowed.includes(k)))throw new HttpError(400,'Field is not part of this schema version.');
          if(body.version!==undefined&&body.version!==job.mapping_version)throw new HttpError(409,'Mapping changed. Refresh before saving.');
          if(Object.values(mapping).filter(Boolean).some(v=>!job.headers.includes(v))) throw new HttpError(400,'Choose columns from this file.');
          await client.query('UPDATE jobs SET mapping=$2::jsonb,transformations=$3::jsonb WHERE id=$1',[id,JSON.stringify(mapping),JSON.stringify(transforms)]);
        } else {
          const body=z.object({row:z.number().int().positive(),raw:z.record(z.string(),z.string().max(4000))}).parse(await request.json());
          if(Object.keys(body.raw).some(v=>!job.headers.includes(v))) throw new HttpError(400,'Unknown source column.');
          const result=await client.query('UPDATE import_rows SET raw=raw || $3::jsonb WHERE job_id=$1 AND row_no=$2',[id,body.row,JSON.stringify(body.raw)]);
          if(!result.rowCount) throw new HttpError(404,'Row not found.');
        }
        await client.query("UPDATE jobs SET status='validating',mapping_version=mapping_version+1,validation_checkpoint=0,approved_hash=NULL,approved_by=NULL,approved_at=NULL,attempts=0,last_error=NULL,updated_at=now(),next_attempt_at=now() WHERE id=$1",[id]);
        await event(client,org,id,'validation',action==='mapping'?'Mapping saved. Validation requested.':'Row corrected. Approval cleared and validation restarted.');
      } else if(action==='approve') {
        const body=z.object({version:z.number().int()}).parse(await request.json());
        if(job.status!=='review' || job.mapping_version!==body.version) throw new HttpError(409,'The preview has changed. Refresh it before approving.');
        await client.query("UPDATE jobs SET status='queued',approved_hash=$2,approved_by=$3,approved_at=now(),updated_at=now() WHERE id=$1",[id,approvalHash(job),user.id]);
        await event(client,org,id,'approved','Reviewer approved this file, mapping version '+job.mapping_version+', and schema version '+job.schema_version+'.');
      } else if(action==='retry') {
        if(job.status!=='failed'||!['parsing','validating','queued','running'].includes(job.suspended_status))throw new HttpError(409,'This import has no retryable phase.');
        if(['queued','running'].includes(job.suspended_status)&&job.approved_hash!==approvalHash(job))throw new HttpError(409,'Approval no longer matches.');
        await client.query("UPDATE jobs SET status=suspended_status,attempts=0,last_error=NULL,next_attempt_at=now(),updated_at=now() WHERE id=$1",[id]);
        await client.query("UPDATE delivery_outbox SET attempts=0 WHERE job_id=$1 AND state='uncertain'",[id]);
        await event(client,org,id,'retry_requested','Reviewer requested a bounded retry from the saved checkpoint.');
      } else if(action==='reconcile') {
        if(!['paused','cancelled'].includes(job.status)||job.destination!=='test-api')throw new HttpError(409,'Receipt-only reconciliation is available for paused or cancelled external imports.');
        await client.query("UPDATE delivery_outbox SET attempts=0 WHERE job_id=$1 AND state='uncertain'",[id]);
        await client.query("UPDATE jobs SET next_attempt_at=now(),updated_at=now() WHERE id=$1",[id]);
        await event(client,org,id,'reconcile_requested','Reviewer requested receipt-only reconciliation. No new destination writes.');
      } else if(action==='pause') {
        if(!['queued','running'].includes(job.status)) throw new HttpError(409,'Only an active import can be paused.');
        await client.query("UPDATE jobs SET status='paused',updated_at=now() WHERE id=$1",[id]);
        await event(client,org,id,'paused','Paused at the last committed batch. Committed contacts are retained.');
      } else if(action==='resume') {
        if(job.status!=='paused') throw new HttpError(409,'Only a paused import can be resumed.');
        if(job.approved_hash!==approvalHash(job)) throw new HttpError(409,'Approval no longer matches this import.');
        await client.query("UPDATE jobs SET status='queued',updated_at=now() WHERE id=$1",[id]);
        await event(client,org,id,'resumed','Resuming from the durable checkpoint.');
      } else if(action==='cancel') {
        if(['completed','cancelled'].includes(job.status)) throw new HttpError(409,'This import has already finished.');
        await client.query("UPDATE jobs SET status='cancelled',updated_at=now() WHERE id=$1",[id]);
        await event(client,org,id,'cancelled','Cancelled. Already committed contacts are retained; remaining rows will not run.');
      } else throw new HttpError(404,'Action not found.');
    });
    return json({ok:true});
  } catch(error) {
    if(error instanceof HttpError) return json({error:error.message},error.status);
    if(error instanceof z.ZodError) return json({error:error.issues.map(i=>i.message).join(' ')},400);
    if(error instanceof SyntaxError || error instanceof URIError) return json({error:'Invalid request.'},400);
    console.error('Relay API error',error instanceof Error ? error.message : 'Unknown error');
    return json({error:'Relay could not complete this request. Check that the database is available.'},503);
  }
}
export { handler as GET, handler as POST };
