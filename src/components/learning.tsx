'use client';
import {useEffect,useState} from 'react';
import {BookOpen,Check,CheckCheck,ChevronDown,Command,Database,Layers3,ShieldCheck} from 'lucide-react';
import {fieldsFor} from '@/lib/contracts';
import learningPath from '../../upskilling/learning-path.json';
import {fmt} from './ui';
export function Destination({contacts}:{contacts:number}){const [version,setVersion]=useState(2);const fields=fieldsFor(version);return <><div className="page-heading"><div><div className="eyebrow">A HOME FOR YOUR CUSTOMER DATA</div><h1>Destination</h1><p>One versioned contract. Consistent data across every import.</p></div><span className="status status-completed"><span className="status-dot"/>Local destination</span></div><div className="destination-hero panel"><div className="destination-logo"><Database size={32}/></div><div><h2>Contacts</h2><p>PostgreSQL · Workspace-isolated records</p></div><div className="destination-total"><strong>{fmt(contacts)}</strong><span>imported contacts</span></div></div><section className="panel schema-panel"><div className="panel-header"><div><h2>Contact schema</h2><p>The contract every approved import follows.</p></div><select aria-label="Contract version" value={version} onChange={e=>setVersion(Number(e.target.value))}><option value={1}>Version 1</option><option value={2}>Version 2</option></select></div><table className="schema-table"><thead><tr><th>Field</th><th>Type</th><th>Requirement</th><th>Validation</th></tr></thead><tbody>{fields.map(f=><tr key={f.key}><td><strong>{f.label}</strong><code>{f.key}</code></td><td>{f.key==='joined_at'?'Date':'Text'}</td><td><span className={f.required?'required-badge':'optional-badge'}>{f.required?'Required':'Optional'}</span></td><td>{f.description}</td></tr>)}</tbody></table></section><div className="destination-principles"><div><ShieldCheck size={22}/><h3>Identity belongs to a workspace</h3><p>Normalized email is unique within an organization. The same email can exist in a different workspace.</p></div><div><CheckCheck size={22}/><h3>Your edits come first</h3><p>Imports never overwrite an existing contact. Differences become explicit conflicts in the report.</p></div><div><Layers3 size={22}/><h3>A reproducible contract</h3><p>Approval is tied to the original file, mapping version and schema version.</p></div></div></>;}
const lessons=[
  {
    "title": "Follow a record from file to destination",
    "topic": "Walking skeleton",
    "focus": "Streaming · API boundaries · background services",
    "prediction": "Which parts keep working after the browser closes?",
    "exercise": "Upload a small file and trace one row through staging, review and contacts. Explain why the API never executes an import.",
    "evidence": "upskilling/labs/01-record-journey.md"
  },
  {
    "title": "Try to cross a workspace boundary",
    "topic": "Tenancy & access",
    "focus": "Membership · roles · credential lifecycle",
    "prediction": "Does knowing another tenant’s import ID grant access?",
    "exercise": "Request a foreign report, attempt approval as an operator, and inspect a single-use invitation. Explain each authorization boundary.",
    "evidence": "upskilling/labs/02-tenancy.md"
  },
  {
    "title": "Make messy data explain itself",
    "topic": "Mapping & validation",
    "focus": "Ambiguous values · corrections · usable errors",
    "prediction": "Should 03/04/2025 become March 4 or April 3?",
    "exercise": "Inspect rejected rows, correct an ambiguous date and revalidate. Explain which source bytes and reviewed versions change.",
    "evidence": "upskilling/labs/03-validation.md"
  },
  {
    "title": "Crash the worker. Keep the promise.",
    "topic": "Durable execution",
    "focus": "Transactions · checkpoints · concurrent workers",
    "prediction": "What happens on either side of the database commit?",
    "exercise": "Run the 100k crash rehearsal, restart two workers and account for every outcome. Compare with the pre-commit crash test.",
    "evidence": "upskilling/labs/04-recovery.md"
  },
  {
    "title": "Approve exactly what you reviewed",
    "topic": "Review & reconciliation",
    "focus": "Version binding · identity · preserving edits",
    "prediction": "Can old approval authorize a later correction?",
    "exercise": "Try a stale mapping version and a destination edit after preview. Explain why existing data survives and which rows become conflicts.",
    "evidence": "upskilling/labs/05-approval.md"
  },
  {
    "title": "Recover context in a fresh session",
    "topic": "Agentic engineering",
    "focus": "Task contracts · evidence · bounded investigation",
    "prediction": "What can another session infer from the handoff alone?",
    "exercise": "Start from project-state.json and HANDOFF.md. Reconstruct one invariant, run its check and record the smallest remaining uncertainty.",
    "evidence": "upskilling/labs/06-fresh-session.md"
  },
  {
    "title": "Measure mistakes before trusting AI",
    "topic": "AI assistance",
    "focus": "Embeddings · evaluations · abstention",
    "prediction": "Should Mailing address map to email?",
    "exercise": "Compare the recorded model error, regression cases and fresh labels. Request a proposal and verify it cannot save or approve itself.",
    "evidence": "upskilling/labs/07-ai-mapping.md"
  },
  {
    "title": "A timeout is not a failed write",
    "topic": "External delivery",
    "focus": "Outbox · receipts · idempotency",
    "prediction": "What exists remotely when the commit response disappears?",
    "exercise": "Run the lost-response rehearsal. Reconcile after restart, replay a key, and explain cancellation with an already committed remote effect.",
    "evidence": "upskilling/labs/08-external-delivery.md"
  },
  {
    "title": "Operate the pipeline and test its limits",
    "topic": "Performance & operations",
    "focus": "Fairness · traces · backup restore",
    "prediction": "Can a small tenant finish while another parses a large file?",
    "exercise": "Inspect batch ordering, supported schemas and trace IDs. Restore a backup into a separate database and verify the original-file hashes.",
    "evidence": "upskilling/labs/09-operations.md"
  },
  {
    "title": "Let someone else diagnose the failure",
    "topic": "Handover",
    "focus": "Independent review · runbooks · communication",
    "prediction": "Where will a new operator need help?",
    "exercise": "Give another person the interface and runbook. Observe an import and an injected failure; record their diagnosis without coaching.",
    "evidence": "upskilling/labs/10-handover.md"
  },
  {
    "title": "Evolve contracts without changing old imports",
    "topic": "Schemas & Excel",
    "focus": "Versioning · streaming · reproducibility",
    "prediction": "Should an extra v2 phone field change v1 results?",
    "exercise": "Compare v1/v2 execution and exports. Try a formula workbook and a quoted-newline CSV, then design a compatible v3 change.",
    "evidence": "upskilling/labs/11-schema-excel.md"
  },
  {
    "title": "Keep a large import usable",
    "topic": "Frontend engineering",
    "focus": "React state · pagination · accessibility",
    "prediction": "How many rows does the browser load for a 100k import?",
    "exercise": "Trace pagination, navigate by keyboard and profile an interaction. Record one measured improvement or justify leaving it unchanged.",
    "evidence": "upskilling/labs/12-frontend.md"
  }
];
export function Learning(){const [open,setOpen]=useState(0),[checked,setChecked]=useState<number[]>([]);
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem('relay-learning')??'[]');if(Array.isArray(value))setChecked(value.filter(v=>Number.isInteger(v)&&v>=0&&v<lessons.length));}catch{}},[]);
 function toggle(i:number){setChecked(v=>{const next=v.includes(i)?v.filter(n=>n!==i):[...v,i];localStorage.setItem('relay-learning',JSON.stringify(next));return next;});}
 return <><div className="page-heading"><div><div className="eyebrow">BUILD IT. BREAK IT. UNDERSTAND IT.</div><h1>Learning lab</h1><p>Start small. Learn to write, debug, test and own a change.</p></div><span className="schema-tag"><BookOpen size={15}/>{checked.length} / {lessons.length} reflected on</span></div><div className="learning-intro"><span className="learning-orbit"><BookOpen size={29}/></span><div><h2>The goal is understanding.</h2><p>Your first target is one function you can write and explain yourself. Build toward independent feature ownership, then practise reliability and senior judgment. These reflections do not assess your skill.</p></div></div><section className="panel learning-start" aria-labelledby="learning-start-title"><div className="eyebrow">START HERE · 30–45 MINUTES · NODE ONLY</div><h2 id="learning-start-title">Your first session: one small function</h2><p>Open <code>upskilling/FIRST_SESSION.md</code>. Predict a worked example, implement a name-cleaning function, write one test, and explain a changed input. The full platform can wait.</p><pre><code>node upskilling/practice/check.mjs name</code></pre><p>The starter is intentionally unfinished. Ask for one hint after you have tried. Save your attempt and help used in <code>upskilling/submissions/</code>.</p></section><section className="learning-path" aria-labelledby="learning-path-title"><h2 id="learning-path-title">Progress by what you can do</h2><ol>{learningPath.stages.map(stage=><li key={stage.id}><h3>{stage.title}</h3><p>{stage.goal}</p><details><summary>What demonstrates this stage?</summary><p>{stage.gate}</p></details></li>)}</ol><p>Placement starts at foundations until your diagnostic shows otherwise. Read <code>upskilling/ROADMAP.md</code>. Senior responsibility requires repeated real collaboration and feedback.</p></section><div className="reference-heading"><h2>Relay reference labs</h2><p>Use these after foundations, in roadmap order. AI mapping and external delivery are later electives. Existing checkmarks remain personal reflections.</p></div><div className="lessons">{lessons.map((l,i)=><section className={'lesson panel '+(open===i?'open':'')} key={l.title}><button className="lesson-heading" onClick={()=>setOpen(open===i?-1:i)} aria-expanded={open===i}><span className={'lesson-number '+(checked.includes(i)?'finished':'')}>{checked.includes(i)?<Check size={19}/>:String(i+1).padStart(2,'0')}</span><div><small>{l.topic}</small><h2>{l.title}</h2><p>{l.focus}</p></div><ChevronDown size={19}/></button>{open===i&&<div className="lesson-body"><div><span className="small-caps">PREDICT</span><p>{l.prediction}</p></div><div><span className="small-caps">EXPLORE & EXPERIMENT</span><p>{l.exercise}</p></div><div><span className="small-caps">FIND THE EVIDENCE</span><code>{l.evidence}</code></div><label className="reflection-check"><input type="checkbox" checked={checked.includes(i)} onChange={()=>toggle(i)}/>I ran the exercise, recorded evidence, and can explain the result.</label></div>}</section>)}</div><div className="learning-footnote"><Command size={19}/><p>Your next task and evidence rubric live in <code>upskilling/</code>. Work on one skill, record the failure and fix, and revisit it with a changed requirement. Build results never mark your learning complete.</p></div></>;
}
