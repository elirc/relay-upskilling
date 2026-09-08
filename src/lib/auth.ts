import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { pool } from './db';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function verifyPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password,salt,64);
  const expectedBytes = Buffer.from(expected,'hex');
  return actual.length === expectedBytes.length && timingSafeEqual(actual,expectedBytes);
}
export async function authenticate(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('relay_session='))?.slice(14);
  if (!cookie || !/^[a-f0-9]{64}$/.test(cookie)) throw new HttpError(401,'Sign in to your workspace.');
  const {rows} = await pool.query('SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[tokenHash(cookie)]);
  if (!rows[0]) throw new HttpError(401,'Your session expired. Please sign in again.');
  return rows[0] as {id:string;name:string;email:string};
}
export async function authorize(request: Request, reviewer = false) {
  const user = await authenticate(request);
  const org = request.headers.get('x-relay-org');
  if (!org || !/^[a-f0-9-]{36}$/.test(org)) throw new HttpError(400,'Choose a workspace.');
  const {rows} = await pool.query('SELECT role FROM memberships WHERE user_id=$1 AND org_id=$2',[user.id,org]);
  if (!rows[0]) throw new HttpError(403,'You do not have access to this workspace.');
  if (reviewer && rows[0].role !== 'reviewer') throw new HttpError(403,'A reviewer must approve this import.');
  return {user,org,role:rows[0].role as string};
}
export async function signIn(email: string, password: string) {
  const {rows: attempts} = await pool.query(`INSERT INTO login_attempts(email,attempts) VALUES($1,1) ON CONFLICT(email) DO UPDATE SET
    attempts=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
    window_start=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`,[email]);
  if (attempts[0].attempts > 20) throw new HttpError(429,'Too many sign-in attempts. Try again in 15 minutes.');
  const {rows} = await pool.query('SELECT id,password_hash FROM users WHERE email=$1',[email]);
  const fallback = '00000000000000000000000000000000:'+'00'.repeat(64);
  const valid = verifyPassword(password, rows[0]?.password_hash ?? fallback);
  if (!rows[0] || !valid) throw new HttpError(401,'Email or password is incorrect.');
  await pool.query('DELETE FROM login_attempts WHERE email=$1',[email]);
  const token=randomBytes(32).toString('hex');
  await pool.query("INSERT INTO sessions VALUES($1,$2,now()+interval '12 hours')",[tokenHash(token),rows[0].id]);
  return token;
}
