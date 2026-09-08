import pg from 'pg';
import {randomBytes,randomUUID,scryptSync,createHash} from 'node:crypto';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const [action,emailArg,nameArg]=process.argv.slice(2),email=emailArg?.toLowerCase();
if(!email||!email.includes('@')||!['bootstrap','reset'].includes(action))throw Error('Usage: node --env-file=.env scripts/account-admin.mjs bootstrap|reset email [workspace name]. Set RELAY_INITIAL_PASSWORD for bootstrap.');
const c=await pool.connect();
try{await c.query('BEGIN');
 if(action==='bootstrap'){
  const password=process.env.RELAY_INITIAL_PASSWORD;if(!password||password.length<12)throw Error('Set RELAY_INITIAL_PASSWORD to at least 12 characters');
  const salt=randomBytes(16).toString('hex'),id=randomUUID(),org=randomUUID();
  await c.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[id,email,email.split('@')[0],salt+':'+scryptSync(password,salt,64).toString('hex')]);
  await c.query('INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)',[org,nameArg??'My workspace','workspace-'+org]);
  await c.query("INSERT INTO memberships(user_id,org_id,role) VALUES($1,$2,'reviewer')",[id,org]);console.log('Reviewer and workspace created.');
 }else{
  const {rowCount}=await c.query('SELECT id FROM users WHERE email=$1',[email]);if(!rowCount)throw Error('Account not found');
  const token=randomBytes(32).toString('hex');await c.query("INSERT INTO account_tokens(token_hash,purpose,email,expires_at) VALUES($1,'reset',$2,now()+interval '30 minutes')",[createHash('sha256').update(token).digest('hex'),email]);console.log('Single-use recovery link (share securely): /?reset='+token);
 }
 await c.query('COMMIT');
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}