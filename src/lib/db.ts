import pg from 'pg';
const globalForPg = globalThis as unknown as { relayPool?: pg.Pool };
export const pool = globalForPg.relayPool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
if (process.env.NODE_ENV !== 'production') globalForPg.relayPool = pool;
export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
