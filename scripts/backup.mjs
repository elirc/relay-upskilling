import {spawn} from 'node:child_process';
import {resolve,join,basename} from 'node:path';
import {existsSync,createReadStream} from 'node:fs';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';
const url=new URL(process.env.DATABASE_URL),pool=new pg.Pool({connectionString:url.toString()});
const tools=process.env.PG_BIN??(existsSync('.tools/pgsql/bin/pg_dump.exe')?resolve('.tools/pgsql/bin'):null);
const executable=name=>tools?join(tools,name+(process.platform==='win32'?'.exe':'')):name;
async function run(name,args){await new Promise((ok,fail)=>{const child=spawn(executable(name),args,{windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)}});let error='';child.stderr.on('data',b=>{error+=b;});child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error(name+' failed: '+error.slice(-2000))));});}
async function digest(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
const directory=resolve('.data/backups',new Date().toISOString().replaceAll(':','-')+'-'+randomBytes(3).toString('hex'));await mkdir(join(directory,'uploads'),{recursive:true});
let restored,snapshotClient;
try{
 // Export one consistent snapshot; pg_dump and this connection see identical rows/checkpoints.
 const client=snapshotClient=await pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const {rows:[snapshot]}=await client.query('SELECT pg_export_snapshot() AS id');
 await run('pg_dump',['--format=custom','--no-owner','--no-acl','--snapshot='+snapshot.id,'--file='+join(directory,'relay.dump'),url.pathname.slice(1)]);
 const {rows:files}=await client.query('SELECT file_key,file_hash FROM jobs ORDER BY file_key');
 const counts={};for(const table of ['jobs','import_rows','contacts','delivery_outbox','test_destination_receipts','users','memberships','job_events'])counts[table]=Number((await client.query('SELECT count(*) AS n FROM '+table)).rows[0].n);
 await client.query('COMMIT');client.release();snapshotClient=undefined;
 for(const file of files){if(basename(file.file_key)!==file.file_key)throw Error('Invalid original-file key');const target=join(directory,'uploads',file.file_key);await copyFile(resolve(process.env.UPLOAD_DIR??'.data/uploads',file.file_key),target);if(await digest(target)!==file.file_hash)throw Error('Original file fingerprint mismatch');}
 const manifest={format:1,createdAt:new Date().toISOString(),databaseArchive:'relay.dump',archiveHash:await digest(join(directory,'relay.dump')),originals:files.length,counts,verifiedRestore:false};
 if(process.argv.includes('--verify')){
  restored='relay_restore_'+randomBytes(6).toString('hex');await pool.query('CREATE DATABASE '+restored);
  await run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname='+restored,join(directory,'relay.dump')]);
  const copyUrl=new URL(url);copyUrl.pathname='/'+restored;const copy=new pg.Pool({connectionString:copyUrl.toString()});
  try{for(const [table,expected] of Object.entries(counts)){const actual=Number((await copy.query('SELECT count(*) n FROM '+table)).rows[0].n);if(actual!==expected)throw Error('Restored count differs: '+table);}const {rows:[invalid]}=await copy.query("SELECT count(*)::int n FROM jobs j WHERE status='completed' AND (commit_checkpoint<>total_rows OR EXISTS(SELECT 1 FROM import_rows r WHERE r.job_id=j.id AND NOT committed))");if(invalid.n)throw Error('Restored completed-job invariant failed');manifest.verifiedRestore=true;}finally{await copy.end();}
 }
 await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 if(manifest.verifiedRestore)await writeFile('upskilling/evidence/backup-restore.json',JSON.stringify({...manifest,backupLocation:'ignored .data/backups directory'},null,2)+'\n');
 console.log(JSON.stringify({directory,originals:manifest.originals,counts,verifiedRestore:manifest.verifiedRestore},null,2));
}finally{
 if(snapshotClient){await snapshotClient.query('ROLLBACK').catch(()=>{});snapshotClient.release();}
 // Only remove the random rehearsal database created by this invocation; never the source database.
 if(restored&&/^relay_restore_[a-f0-9]{12}$/.test(restored)&&restored!==url.pathname.slice(1))await pool.query('DROP DATABASE '+restored+' WITH (FORCE)');
 await pool.end();
}