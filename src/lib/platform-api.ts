import {NextResponse} from 'next/server';
import {randomBytes,randomUUID,scryptSync} from 'node:crypto';
import {z} from 'zod';
import {pool,transaction} from './db';
import {authenticate,HttpError,tokenHash,verifyPassword} from './auth';
const json=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'no-store'}});
const password=z.string().min(12,'Use at least 12 characters.').max(200);
export function hashPassword(value:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(value,salt,64).toString('hex');}
export async function platformPublic(request:Request,parts:string[]){
 if(parts[0]==='health'&&request.method==='GET'){await pool.query('SELECT version FROM destination_schemas WHERE version=2');return json({ok:true,version:'0.2.0',schemas:[1,2]});}
 if(parts[0]==='account'&&parts[1]==='consume'&&request.method==='POST'){
  const body=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:password.optional(),name:z.string().min(1).max(100).optional(),currentPassword:z.string().max(200).optional()}).parse(await request.json());
  const {rows:[attempt]}=await pool.query("INSERT INTO login_attempts(email,attempts) VALUES($1,1) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts",['token:'+tokenHash(body.token)]);
  if(attempt.attempts>20)throw new HttpError(429,'Too many attempts. Try again in 15 minutes.');
  await transaction(async c=>{
   const {rows:[token]}=await c.query('SELECT * FROM account_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[tokenHash(body.token)]);
   if(!token)throw new HttpError(400,'This link is invalid, expired, or already used.');
   const {rows:[user]}=await c.query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[token.email]);
   let userId=user?.id;
   if(token.purpose==='invite'){
    if(user&&!verifyPassword(body.currentPassword??'',user.password_hash))throw new HttpError(401,'An account already exists. Enter its current password to accept this invitation.');
    if(!user){userId=randomUUID();await c.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[userId,token.email,body.name??token.email,hashPassword(password.parse(body.password))]);}
    await c.query('INSERT INTO memberships(user_id,org_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,token.org_id,token.role]);
   }else{
    if(!user)throw new HttpError(400,'This recovery link is invalid.');
    await c.query('UPDATE users SET password_hash=$2 WHERE id=$1',[userId,hashPassword(password.parse(body.password))]);
    await c.query('DELETE FROM sessions WHERE user_id=$1',[userId]);
    await c.query("UPDATE account_tokens SET used_at=now() WHERE email=$1 AND purpose='reset' AND used_at IS NULL",[token.email]);
   }
   await c.query('UPDATE account_tokens SET used_at=now() WHERE token_hash=$1',[tokenHash(body.token)]);
  });return json({ok:true});
 }
 if(parts[0]==='account'&&parts[1]==='password'&&request.method==='POST'){
  const user=await authenticate(request);const body=z.object({currentPassword:z.string().max(200),password}).parse(await request.json());
  await transaction(async c=>{const {rows:[record]}=await c.query('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE',[user.id]);if(!verifyPassword(body.currentPassword,record.password_hash))throw new HttpError(400,'Current password is incorrect.');await c.query('UPDATE users SET password_hash=$2 WHERE id=$1',[user.id,hashPassword(password.parse(body.password))]);await c.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);});
  const response=json({ok:true});response.cookies.delete('relay_session');return response;
 }
 return null;
}
export async function platformPrivate(request:Request,parts:string[],access:{user:{id:string};org:string;role:string}){
 const {user,org,role}=access;
 if(parts[0]==='schemas'&&request.method==='GET'){const {rows}=await pool.query('SELECT version,contract,digest FROM destination_schemas ORDER BY version');return json({schemas:rows});}
 if(parts[0]==='team'){
  if(role!=='reviewer')throw new HttpError(403,'A workspace reviewer manages membership.');
  if(request.method==='GET'){
   const {rows:members}=await pool.query('SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=$1 ORDER BY u.name',[org]);
   const {rows:invitations}=await pool.query("SELECT email,role,expires_at,used_at FROM account_tokens WHERE org_id=$1 AND purpose='invite' ORDER BY created_at DESC LIMIT 50",[org]);return json({members,invitations});
  }
  if(request.method==='POST'&&parts[1]==='invite'){
   const body=z.object({email:z.string().email().max(200),role:z.enum(['operator','reviewer'])}).parse(await request.json());
   const token=randomBytes(32).toString('hex');
   await pool.query("INSERT INTO account_tokens(token_hash,purpose,email,org_id,role,expires_at,created_by) VALUES($1,'invite',$2,$3,$4,now()+interval '7 days',$5)",[tokenHash(token),body.email.toLowerCase(),org,body.role,user.id]);
   return json({link:'/?invite='+token,expiresInDays:7},201);
  }
 }
 if(parts[0]==='ops'&&request.method==='GET'){
  if(role!=='reviewer')throw new HttpError(403,'Operational diagnostics require a reviewer.');
  const {rows:phases}=await pool.query(`SELECT phase,count(*)::int batches,sum(rows_processed)::int rows,round(sum(rows_processed)/greatest(sum(duration_ms)/1000,0.001))::int rows_per_second,round(percentile_cont(0.95) WITHIN GROUP(ORDER BY duration_ms)::numeric,1)::float p95_ms,max(memory_bytes)::text max_memory FROM batch_metrics WHERE org_id=$1 AND created_at>now()-interval '24 hours' GROUP BY phase ORDER BY phase`,[org]);
  const {rows:workers}=await pool.query("SELECT version,schemas,last_seen,memory_bytes FROM worker_heartbeats WHERE last_seen>now()-interval '1 minute' ORDER BY last_seen DESC LIMIT 20");
  const {rows:recent}=await pool.query('SELECT job_id,phase,rows_processed,duration_ms,checkpoint,trace_id,created_at FROM batch_metrics WHERE org_id=$1 ORDER BY id DESC LIMIT 25',[org]);
  const {rows:[pending]}=await pool.query("SELECT count(*)::int uncertain FROM delivery_outbox WHERE org_id=$1 AND state='uncertain'",[org]);
  return json({phases,workers,recent,uncertain:pending.uncertain});
 }
 return null;
}