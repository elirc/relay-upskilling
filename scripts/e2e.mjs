import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createWriteStream,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import pg from 'pg';
import {generateFixture} from './fixture.mjs';
const base=process.env.RELAY_URL??'http://127.0.0.1:4317';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const acme='10000000-0000-0000-0000-000000000001',north='10000000-0000-0000-0000-000000000002';
const workers=[],suffix=randomUUID().slice(0,8);
await mkdir('test-results',{recursive:true});
const evidence={startedAt:new Date().toISOString(),checks:[],large:process.env.RELAY_LARGE_TEST==='true'};
function passed(name){evidence.checks.push(name);console.log('PASS',name);}
async function login(email){
 const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:process.env.DEMO_PASSWORD})});
 assert.equal(r.status,200,await r.text());return r.headers.get('set-cookie').split(';')[0];
}
const alice=await login('alex@relay.local'),sam=await login('sam@relay.local'),jules=await login('jules@relay.local');
async function req(path,{cookie=alice,org=acme,method='GET',body,status=200,raw=false}={}){
 const r=await fetch(base+'/api/'+path,{method,headers:{Cookie:cookie,'x-relay-org':org,...(raw?{'x-file-name':'e2e-'+suffix+'.csv','Content-Type':'text/csv'}:{'Content-Type':'application/json'})},body:body===undefined?undefined:raw?body:JSON.stringify(body)});
 assert.equal(r.status,status,await r.clone().text());return r;
}
async function get(id){return (await req('jobs/'+id).then(r=>r.json())).job;}
async function wait(id,status,timeout=600000){
 const start=Date.now();
 while(Date.now()-start<timeout){const j=await get(id);if(j.status===status)return j;if(j.status==='failed')throw new Error('Worker failed: '+j.last_error);await new Promise(r=>setTimeout(r,400));}
 throw new Error('Timed out waiting for '+id+' '+status);
}
const dotnet=process.env.DOTNET_EXE??(existsSync('.tools/dotnet/dotnet.exe')?resolve('.tools/dotnet/dotnet.exe'):'dotnet');
function worker(crash=0,delay=0){
 const out=createWriteStream('test-results/worker-'+workers.length+'.log');
 const child=spawn(dotnet,[resolve('worker/bin/Debug/net10.0/Relay.Worker.dll')],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,Relay__CrashAfterRows:String(crash),Relay__BatchDelayMs:String(delay),DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
 child.stdout.pipe(out);child.stderr.pipe(out);child.exited=new Promise(r=>child.on('exit',(code)=>r(code)));workers.push(child);return child;
}
const mapping={name:'Full Name',email:'Email Address',company:'Company',joined_at:'Signup Date'};
async function upload(csv){return (await req('jobs',{method:'POST',raw:true,body:csv,status:201}).then(r=>r.json())).id;}
async function map(id){await wait(id,'mapping');await req('jobs/'+id+'/mapping',{method:'POST',body:mapping});return wait(id,'review');}
async function approve(id,j){await req('jobs/'+id+'/approve',{method:'POST',body:{version:j.mapping_version}});}
try{
 const anon=await fetch(base+'/api/overview');assert.equal(anon.status,401);passed('Anonymous requests denied');
 worker(0,40);
 const csv='Full Name,Email Address,Company,Signup Date\r\n'+[
  ['Alex','A-'+suffix+'@EXAMPLE.COM','Example','2025/01/15'],
  ['Duplicate','a-'+suffix+'@example.com','Example','2025-01-15'],
  ['Missing','','Example','2025-01-15'],
  ['Ambiguous','b-'+suffix+'@example.com','Example','03/04/2025'],
  ['=SUM(1+1)','c-'+suffix+'@example.com','Example','2025-01-15']
 ].map(r=>r.join(',')).join('\r\n');
 const id=await upload(csv);let j=await map(id);
 assert.deepEqual(j.counts,{ready:2,duplicate:1,rejected:2});passed('CSV normalization, duplicate classification and ambiguous-date rejection');
 for(const path of ['jobs/'+id,'jobs/'+id+'/rows','jobs/'+id+'/report'])await req(path,{cookie:jules,org:north,status:404});
 await req('jobs/'+id,{cookie:jules,status:403});
 await req('jobs/'+id+'/approve',{cookie:sam,method:'POST',body:{version:j.mapping_version},status:403});
 passed('Tenant isolation on jobs, rows, downloads; operator approval denied');
 const old=j.mapping_version;
 await req('jobs/'+id+'/correct',{method:'POST',body:{row:4,raw:{'Signup Date':'2025-03-04'}}});j=await wait(id,'review');
 assert.equal(j.mapping_version,old+1);assert.equal(j.approved_hash,null);
 await req('jobs/'+id+'/approve',{method:'POST',body:{version:old},status:409});passed('Correction invalidates approval; stale review is rejected');
 // Introduce a destination edit AFTER preview. Import must preserve it.
 await pool.query("INSERT INTO contacts(id,org_id,email,data,source_job_id,source_row_no) VALUES($1,$2,$3,$4,$5,1)",[randomUUID(),acme,'a-'+suffix+'@example.com',JSON.stringify({name:'Edited by user',email:'a-'+suffix+'@example.com',company:'Protected',joined_at:'2025-01-15'}),id]);
 await approve(id,j);j=await wait(id,'completed');
 assert.equal(j.counts.imported,2);assert.equal(j.counts.conflict,1);assert.equal(j.commit_checkpoint,5);
 const preserved=await pool.query('SELECT data FROM contacts WHERE org_id=$1 AND email=$2',[acme,'a-'+suffix+'@example.com']);assert.equal(preserved.rows[0].data.name,'Edited by user');
 passed('Reconciliation preserves edits made after preview');
 const report=await req('jobs/'+id+'/report').then(r=>r.text());assert(report.includes("'=SUM(1+1)"));assert.equal(report.trim().split('\n').length,6);passed('Every row exported and spreadsheet formulas neutralized');
 await req('jobs/'+id+'/mapping',{method:'POST',body:mapping,status:409});passed('Completed imports cannot mutate their approved mapping');
 const second=await upload(csv);j=await map(second);await approve(second,j);j=await wait(second,'completed');assert.equal(j.counts.imported??0,0);passed('Repeated imports do not duplicate destination effects');
 // Pause/resume/cancel a multi-batch import while two real worker processes compete.
 worker(0,40);
 const many='Full Name,Email Address,Company,Signup Date\r\n'+Array.from({length:5000},(_,i)=>'Name '+i+',control-'+suffix+'-'+i+'@example.com,Example,2025-01-15').join('\r\n');
 const control=await upload(many);j=await map(control);await approve(control,j);
 await req('jobs/'+control+'/pause',{method:'POST',body:{}});j=await get(control);const checkpoint=j.commit_checkpoint;
 await new Promise(r=>setTimeout(r,200));assert.equal((await get(control)).commit_checkpoint,checkpoint);
 await req('jobs/'+control+'/resume',{method:'POST',body:{}});await req('jobs/'+control+'/cancel',{method:'POST',body:{}});
 j=await get(control);assert.equal(j.status,'cancelled');const cancelled=j.commit_checkpoint;await new Promise(r=>setTimeout(r,200));assert.equal((await get(control)).commit_checkpoint,cancelled);
 passed('Concurrent workers respect pause, resume and terminal cancellation');
 if(evidence.large){
  for(const w of workers)if(w.exitCode===null)w.kill();await Promise.all(workers.map(w=>w.exited));
  await generateFixture('test-results/contacts-100k.csv',100000,'-'+suffix);
  const crashWorker=worker(50000);
  const big=await upload(await readFile('test-results/contacts-100k.csv'));j=await map(big);
  assert.equal(j.total_rows,100000);assert.equal(j.counts.rejected,1600);assert.equal(j.counts.duplicate,800);assert.equal(j.counts.ready,97600);
  await approve(big,j);
  await Promise.race([crashWorker.exited,new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('Crash timeout')),600000);t.unref();})]);
  assert.equal(crashWorker.exitCode,73);j=await get(big);assert.equal(j.commit_checkpoint,50000);assert.equal(j.status,'running');
  passed('Real worker process exits at committed checkpoint 50,000');
  worker(50000);worker(50000); // Persistent marker prevents a repeated injected crash.
  j=await wait(big,'completed',600000);
  assert.equal(j.commit_checkpoint,100000);assert.equal(j.counts.imported,97600);
  const accounting=await pool.query('SELECT count(*)::int total,count(*) FILTER(WHERE committed)::int committed FROM import_rows WHERE job_id=$1',[big]);assert.deepEqual(accounting.rows[0],{total:100000,committed:100000});
  const unique=await pool.query('SELECT count(*)::int n,count(DISTINCT email)::int identities FROM contacts WHERE source_job_id=$1',[big]);assert.deepEqual(unique.rows[0],{n:97600,identities:97600});
  const exported=await req('jobs/'+big+'/report').then(r=>r.text());assert.equal(exported.trim().split('\n').length,100001);
  evidence.recovery={job:big,checkpoint:50000,outcomes:j.counts,accountedRows:100000};
  passed('100,000-row restart with two workers: no duplicate effects and every row accounted for');
 }
 evidence.finishedAt=new Date().toISOString();evidence.result='passed';
}catch(error){evidence.result='failed';evidence.error=String(error);throw error;}
finally{for(const w of workers)if(w.exitCode===null)w.kill();await pool.end();await writeFile('test-results/e2e.json',JSON.stringify(evidence,null,2));}
