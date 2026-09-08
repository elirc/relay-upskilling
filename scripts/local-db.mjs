import { existsSync } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import pg from 'pg';
if(process.platform!=='win32'){
 const {default:EmbeddedPostgres}=await import('embedded-postgres');
 const db=new EmbeddedPostgres({databaseDir:'.data/postgres',user:'relay',password:'relay_local',port:54329,persistent:true,postgresFlags:['-h','127.0.0.1']});
 if(!existsSync('.data/postgres/PG_VERSION'))await db.initialise();
 await db.start();try{await db.createDatabase('relay');}catch(e){if(!String(e).includes('already exists'))throw e;}
 for(const s of ['SIGINT','SIGTERM'])process.on(s,async()=>{await db.stop();process.exit(0);});
 setInterval(()=>{},60000);
}else{
 const bin=resolve('node_modules/@embedded-postgres/windows-x64/native/bin');
 await mkdir('.data',{recursive:true});
 if(!existsSync('.data/postgres/PG_VERSION')){
  await writeFile('.data/pg-password','relay_local');
  try{execFileSync(resolve(bin,'initdb.exe'),['-D',resolve('.data/postgres'),'-U','relay','--pwfile='+resolve('.data/pg-password'),'--auth=scram-sha-256','--encoding=UTF8','--locale=C'],{stdio:'inherit',windowsHide:true});}finally{await unlink('.data/pg-password');}
 }
 const child=spawn(resolve(bin,'postgres.exe'),['-D',resolve('.data/postgres'),'-p','54329','-h','127.0.0.1'],{stdio:'inherit',windowsHide:true});
 child.on('exit',code=>process.exit(code??0));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{execFileSync(resolve(bin,'pg_ctl.exe'),['-D',resolve('.data/postgres'),'-m','fast','stop'],{windowsHide:true});});
 for(let i=0;i<50;i++){try{const c=new pg.Client({connectionString:'postgresql://relay:relay_local@127.0.0.1:54329/postgres'});await c.connect();const r=await c.query("SELECT 1 FROM pg_database WHERE datname='relay'");if(!r.rowCount)await c.query('CREATE DATABASE relay');await c.end();console.log('Local PostgreSQL ready at 127.0.0.1:54329. Data persists in .data/postgres.');break;}catch{await new Promise(r=>setTimeout(r,300));}}
}
