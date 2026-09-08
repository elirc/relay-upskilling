import {resolve} from 'node:path';
export const model='Xenova/all-MiniLM-L6-v2';
export const revision='751bff37182d3f1213fa05d7196b954e230abad9';
const aliases={name:['name','fullname','contactname'],email:['email','emailaddress','emailid'],company:['company','companyname','organization'],joined_at:['joinedat','signupdate','createdat','datejoined'],phone:['phone','phonenumber','telephone','mobile']};
const anchors={name:['Full name of the person','Contact first and last name','Customer name'],email:['Email address','Electronic mail address','Contact email'],company:['Company name','Employer organization','Business name'],joined_at:['Date the contact signed up','Account registration date','Date joined'],phone:['Telephone number','Mobile phone number','Contact phone with country code']};
let extractor,anchorVectors;
async function setup(){if(!extractor)extractor=(async()=>{const {pipeline,env}=await import('@huggingface/transformers');env.cacheDir=resolve(process.env.RELAY_MODEL_CACHE??'.cache/models');return pipeline('feature-extraction',model,{revision,dtype:'q8',device:'cpu'});})();return extractor;}
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
export async function suggest(headers,version=1){
 if(!Array.isArray(headers)||headers.length<1||headers.length>100||headers.some(h=>typeof h!=='string'||h.length>200)||new Set(headers).size!==headers.length)throw Error('Invalid headers');
 if(![1,2].includes(version))throw Error('Unsupported schema');
 const fields=Object.keys(anchors).filter(f=>version===2||f!=='phone');
 const pipe=await setup();
 if(!anchorVectors)anchorVectors=await pipe(Object.values(anchors).flat(),{pooling:'mean',normalize:true}).then(v=>v.tolist());
 const vectors=(await pipe(headers,{pooling:'mean',normalize:true})).tolist();
 const candidates=headers.map((h,i)=>{
  const scores=fields.map(f=>({field:f,score:Math.max(...anchorVectors.slice(Object.keys(anchors).indexOf(f)*3,Object.keys(anchors).indexOf(f)*3+3).map(v=>dot(vectors[i],v)))})).sort((a,b)=>b.score-a.score);
  const alias=fields.find(f=>aliases[f].includes(h.toLowerCase().replace(/[^a-z]/g,'')));
  const unsafe=/ignore|instruction|system prompt|password|secret|api.?key|mailing address|postal|street address|birth date/i.test(h);
  return {source:h,field:alias??scores[0].field,score:scores[0].score,margin:scores[0].score-scores[1].score,method:alias?'alias':'embedding',accepted:!unsafe&&(!!alias||(scores[0].score>=0.60&&scores[0].score-scores[1].score>=0.12))};
 });
 const suggestions=fields.map(field=>{
  const matches=candidates.filter(c=>c.field===field&&c.accepted);
  if(matches.length!==1)return {field,source:null,method:'abstain',score:null,margin:null,reason:matches.length>1?'Multiple source columns may match. Choose one.':'No sufficiently distinct match. Choose a column manually.',transform:'none'};
  const c=matches[0];return {field,source:c.source,method:c.method,score:Number(c.score.toFixed(4)),margin:Number(c.margin.toFixed(4)),reason:c.method==='alias'?'Recognized column alias. Review before applying.':'Semantic similarity exceeded the score and separation thresholds. Review before applying.',transform:field==='name'||field==='company'?'collapse_spaces':field==='phone'?'strip_phone_formatting':'none'};
 });
 return {model,revision,policy:'relay-mapping-2',schemaVersion:version,suggestions};
}