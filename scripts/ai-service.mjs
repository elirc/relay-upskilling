import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {suggest} from '../services/mapping-engine.mjs';
const key=process.env.RELAY_AI_KEY??(process.env.RELAY_DEMO_MODE==='true'?'relay-local-ai':null);
if(!key)throw Error('Set RELAY_AI_KEY');
let busy=false;
http.createServer(async(req,res)=>{
 const reply=(status,b)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(b));};
 if(req.url==='/health')return reply(200,{ok:true,busy});
 const actual=Buffer.from(String(req.headers.authorization??'')),expected=Buffer.from('Bearer '+key);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply(401,{error:'Unauthorized'});
 if(req.url!=='/suggest'||req.method!=='POST')return reply(404,{error:'Not found'});
 if(busy)return reply(429,{error:'Mapping assistant is busy. Try again shortly.'});
 busy=true;
 try{let s='';for await(const b of req){s+=b;if(s.length>30000)throw Error('Body too large');}const body=JSON.parse(s);reply(200,await suggest(body.headers,body.schemaVersion));}
 catch(error){console.error('Mapping assistant failed:',error.name);reply(503,{error:'Mapping assistant unavailable. Manual mapping remains available.'});}finally{busy=false;}
}).listen(Number(process.env.RELAY_AI_PORT??4319),process.env.RELAY_BIND??'127.0.0.1',()=>console.log('Relay mapping assistant ready'));