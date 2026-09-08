import pg from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
if (process.env.RELAY_DEMO_MODE !== 'true') throw new Error('Demo seed requires RELAY_DEMO_MODE=true.');
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) throw new Error('Set DEMO_PASSWORD with at least 12 characters.');
const salt = randomBytes(16).toString('hex');
const hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`INSERT INTO organizations(id,name,slug) VALUES
    ('10000000-0000-0000-0000-000000000001','Acme, Inc.','acme'),
    ('10000000-0000-0000-0000-000000000002','Northstar Labs','northstar') ON CONFLICT DO NOTHING`);
  for (const [id,email,name] of [
    ['20000000-0000-0000-0000-000000000001','alex@relay.local','Alex Morgan'],
    ['20000000-0000-0000-0000-000000000002','sam@relay.local','Sam Rivera'],
    ['20000000-0000-0000-0000-000000000003','jules@relay.local','Jules Park']
  ]) await client.query('INSERT INTO users VALUES($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash',[id,email,name,hash]);
  await client.query(`INSERT INTO memberships VALUES
    ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','reviewer'),
    ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','operator'),
    ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','reviewer') ON CONFLICT DO NOTHING`);
  await client.query('COMMIT');
  console.log('Demo organizations and accounts seeded. Password comes from DEMO_PASSWORD.');
} finally { client.release(); await pool.end(); }
