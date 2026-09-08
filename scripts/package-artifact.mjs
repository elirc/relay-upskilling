import {access,cp,readdir,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const artifact=resolve('.next/standalone');
assert.equal(artifact,resolve(process.cwd(),'.next','standalone'));
for(const name of await readdir(artifact)){
 if(name==='.env'||name.startsWith('.env.'))await unlink(join(artifact,name));
}
for(const name of ['.env','.cache','.tools','.data','worker','upskilling']){
 let exists=true;try{await access(join(artifact,name));}catch{exists=false;}
 assert(!exists,'Unexpected local-only file in deployment artifact: '+name);
}
await cp(resolve('.next/static'),join(artifact,'.next/static'),{recursive:true});
console.log('Standalone artifact verified: no environment files, uploads, local tools or learning sources. Static assets copied.');
