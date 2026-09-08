import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const secret=process.env.RELAY_CONNECTOR_KEY??(process.env.RELAY_DEMO_MODE==='true'?'relay-local-connector':null);
if(!secret)throw Error('Set RELAY_CONNECTOR_KEY');
const hash=v=>createHash('sha256').update(v).digest('hex');
const equal=(a,b)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const uuid=/^[a-f0-9]{8}-[a-f0-9-]{27}$/i;
async function body(req){let s='';for await(const b of req){s+=b;if(s.length>4*1024*1024)throw Error('Body too large');}return JSON.parse(s);}
const server=http.createServer(async(req,res)=>{
 const reply=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(value));};
 if(req.url==='/health')return reply(200,{ok:true});
 if(!equal(String(req.headers.authorization??''),'Bearer '+secret))return reply(401,{error:'Unauthorized'});
 let c;
 try{
  const b=await body(req);if(!uuid.test(b.tenantId))return reply(400,{error:'Invalid tenant'});
  if(req.url==='/admin/fault'&&req.method==='POST'){
   if(!['none','throttle-once','lose-response-once'].includes(b.mode))throw Error('Unknown fault');
   await pool.query('INSERT INTO test_destination_faults(org_id,mode,remaining) VALUES($1,$2,$3) ON CONFLICT(org_id) DO UPDATE SET mode=$2,remaining=$3',[b.tenantId,b.mode,b.mode==='none'?0:1]);return reply(200,{ok:true});
  }
  if(req.url==='/v1/receipts'&&req.method==='POST'){
   if(!Array.isArray(b.keys)||b.keys.length>2000||b.keys.some(k=>typeof k!=='string'||k.length>100))throw Error('Invalid keys');
   const {rows}=await pool.query('SELECT key AS key,outcome,payload_hash FROM test_destination_receipts WHERE org_id=$1 AND key=ANY($2)',[b.tenantId,b.keys]);return reply(200,{receipts:rows});
  }
  if(req.url!=='/v1/batches'||req.method!=='POST')return reply(404,{error:'Not found'});
  if(!Array.isArray(b.items)||b.items.length>2000||b.items.some(i=>typeof i.key!=='string'||i.key.length>100||!i.payload||typeof i.payload.email!=='string'||Object.values(i.payload).some(v=>typeof v!=='string'||v.length>16000)))throw Error('Invalid batch');
  c=await pool.connect();await c.query('BEGIN');
  await c.query('INSERT INTO test_destination_faults(org_id) VALUES($1) ON CONFLICT DO NOTHING',[b.tenantId]);
  const {rows:[fault]}=await c.query('SELECT * FROM test_destination_faults WHERE org_id=$1 FOR UPDATE',[b.tenantId]);
  await c.query('UPDATE test_destination_faults SET calls=calls+1 WHERE org_id=$1',[b.tenantId]);
  if(fault.mode==='throttle-once'&&fault.remaining>0){await c.query('UPDATE test_destination_faults SET remaining=0,throttles=throttles+1 WHERE org_id=$1',[b.tenantId]);await c.query('COMMIT');return reply(429,{error:'Rate limited'},{'Retry-After':'2'});}
  const receipts=[];
  // One tenant lock serializes the test API's contact comparison with receipt creation.
  for(const item of b.items){
   const payloadHash=hash(JSON.stringify(Object.fromEntries(Object.entries(item.payload).sort(([a],[b])=>a.localeCompare(b)))));
   const {rows:[old]}=await c.query('SELECT outcome,payload_hash FROM test_destination_receipts WHERE org_id=$1 AND key=$2',[b.tenantId,item.key]);
   if(old){if(old.payload_hash!==payloadHash){await c.query('ROLLBACK');return reply(409,{error:'Idempotency key payload changed'});}receipts.push({key:item.key,outcome:old.outcome});continue;}
   const inserted=await c.query('INSERT INTO test_destination_contacts(org_id,email,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING email',[b.tenantId,item.payload.email,JSON.stringify(item.payload)]);
   const {rows:[contact]}=await c.query('SELECT data FROM test_destination_contacts WHERE org_id=$1 AND email=$2 FOR SHARE',[b.tenantId,item.payload.email]);
   const outcome=inserted.rowCount?'imported':Object.entries(item.payload).every(([k,v])=>(contact.data[k]??'')===v)?'existing':'conflict';
   await c.query('INSERT INTO test_destination_receipts(org_id,key,payload_hash,outcome,trace_id) VALUES($1,$2,$3,$4,$5)',[b.tenantId,item.key,payloadHash,outcome,String(req.headers.traceparent??'').slice(0,100)]);receipts.push({key:item.key,outcome});
  }
  const lose=fault.mode==='lose-response-once'&&fault.remaining>0;
  if(lose)await c.query('UPDATE test_destination_faults SET remaining=0,lost_responses=lost_responses+1 WHERE org_id=$1',[b.tenantId]);
  await c.query('COMMIT');
  if(lose){req.socket.destroy();return;}
  reply(200,{receipts});
 }catch{if(c)await c.query('ROLLBACK').catch(()=>{});if(!res.headersSent)reply(400,{error:'Destination request failed'});}finally{c?.release();}
});
server.listen(Number(process.env.RELAY_CONNECTOR_PORT??4321),process.env.RELAY_BIND??'127.0.0.1',()=>console.log('Relay test destination ready'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>pool.end().then(()=>process.exit(0))));