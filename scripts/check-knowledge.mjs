import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const state=JSON.parse(await readFile('upskilling/project-state.json','utf8'));
const catalog=JSON.parse(await readFile('upskilling/learning-material-catalog.json','utf8'));
assert.equal(state.project_id,catalog.project_id);
assert.equal(new Set(catalog.materials.map(m=>m.material_id)).size,catalog.materials.length);
for(const m of catalog.materials){await access(m.path);for(const id of m.prerequisites??[])assert(catalog.materials.some(p=>p.material_id===id));}
for(const invariant of state.invariants)for(const path of invariant.evidence)await access(path);
for(const key of ['handoff','next_task'])await access(state[key]);
const projects=JSON.parse(await readFile('upskilling/project-catalog.json','utf8'));
const progress=JSON.parse(await readFile('upskilling/analysis-progress.json','utf8'));
const graph=JSON.parse(await readFile('upskilling/project-relationships.json','utf8'));
const learner=JSON.parse(await readFile('upskilling/learner-progress.json','utf8'));
assert.equal(projects.projects.length,1);assert.equal(projects.projects[0].project_id,state.project_id);
assert(progress.projects_discovered.includes(state.project_id));assert(graph.nodes.some(n=>n.project_id===state.project_id));
assert.equal(learner.project_id,state.project_id);
for(const m of catalog.materials)assert.equal(m.project_id,state.project_id);
for(const l of learner.labs)assert(catalog.materials.some(m=>m.material_id===l.material_id));
for(const file of projects.projects[0].evidence.implementation_evidence)await access(file);
const path=JSON.parse(await readFile('upskilling/learning-path.json','utf8'));
assert.equal(path.project_id,state.project_id);
assert.equal(path.progress_path,'upskilling/learner-progress.json');
const materials=new Map(catalog.materials.map(m=>[m.material_id,m]));
assert(materials.has(path.entry_material));
assert.equal(state.learning.next_lab,materials.get(path.entry_material).path);
const visited=new Set(),visiting=new Set();
function visit(id){
 assert(materials.has(id),`Missing material ${id}`);
 assert(!visiting.has(id),`Prerequisite cycle at ${id}`);
 if(visited.has(id))return;
 visiting.add(id);for(const prerequisite of materials.get(id).prerequisites??[])visit(prerequisite);
 visiting.delete(id);visited.add(id);
}
for(const id of materials.keys())visit(id);
const stages=new Set();
for(const stage of path.stages){
 assert(!stages.has(stage.id));
 for(const prerequisite of stage.prerequisites)assert(stages.has(prerequisite),`Stage order: ${stage.id}`);
 for(const id of stage.materials)assert(materials.has(id),`Missing stage material ${id}`);
 assert(stage.gate&&stage.goal);stages.add(stage.id);
}
for(const elective of path.electives){assert(materials.has(elective.material_id));assert(stages.has(elective.after_stage));}
assert.equal(new Set(learner.labs.map(l=>l.material_id)).size,learner.labs.length);
assert.equal(new Set(learner.stages.map(s=>s.stage_id)).size,learner.stages.length);
for(const stage of learner.stages){assert(stages.has(stage.stage_id));for(const file of stage.evidence_paths)await access(file);}
for(const lab of learner.labs){assert(lab.score===null||[0,1,2,3].includes(lab.score));for(const file of lab.evidence_paths)await access(file);}
console.log('Project knowledge: stable project/material IDs, learner references, graph, prerequisites and evidence paths verified.');
console.log('Learning path: entry point, acyclic material prerequisites, stage order, electives and learner references verified.');
