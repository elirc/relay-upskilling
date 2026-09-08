import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const c=await pool.connect();
try{
 await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(726351)');
 await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 const paths=(await readdir(new URL('../db/',import.meta.url))).filter(p=>/^\d+.*\.sql$/.test(p)).sort();
 for(const name of paths){
  if((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount)continue;
  await c.query(await readFile(new URL('../db/'+name,import.meta.url),'utf8'));
  await c.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
 }
 const {schemas}=JSON.parse(await readFile(new URL('../contracts/contact-schemas.json',import.meta.url),'utf8'));
 for(const schema of schemas){
  const digest=createHash('sha256').update(JSON.stringify(schema)).digest('hex');
  await c.query('INSERT INTO destination_schemas VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[schema.version,JSON.stringify(schema),digest]);
  const existing=await c.query('SELECT digest FROM destination_schemas WHERE version=$1',[schema.version]);
  if(existing.rows[0].digest!==digest)throw Error('An existing contract changed. Publish a new schema version.');
 }
 await c.query('COMMIT');console.log('Versioned migrations and immutable contracts verified.');
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
