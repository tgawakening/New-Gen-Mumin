"use client";
import { useState } from "react";
import { previewRecovery, saveRecovery } from "@/app/admin/attendance/actions";
import type { RecoveryInput } from "@/lib/live-classes/admin-attendance";
type Learner = { id: string; name: string; parents: string; teachers: string[] };
type Preview = NonNullable<Awaited<ReturnType<typeof previewRecovery>>['data']>;
type Choice = { mode: RecoveryInput['mode']; missedCount: number; missedKeys: string[]; teacherId: string; parentName: string };
export function AdminAttendanceRecovery({ learners, today }: { learners: Learner[]; today: string }) {
  const [search,setSearch]=useState('');
  const [ids,setIds]=useState<string[]>([]);
  const [from,setFrom]=useState(`${today.slice(0,4)}-08-01` > today ? `${Number(today.slice(0,4))-1}-08-01` : `${today.slice(0,4)}-08-01`);
  const [to,setTo]=useState(today);
  const [note,setNote]=useState('');
  const [previews,setPreviews]=useState<Record<string,Preview>>({});
  const [choices,setChoices]=useState<Record<string,Choice>>({});
  const [results,setResults]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [rangePreviewed,setRangePreviewed]=useState('');
  const rangeKey=`${from}:${to}`;
  const ready=rangeKey===rangePreviewed&&ids.length>0&&ids.every(id=>previews[id]?.sessions.length);
  const filtered=learners.filter(student=>`${student.name} ${student.parents} ${student.teachers.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  function change(id:string,patch:Partial<Choice>){setChoices(current=>({...current,[id]:{...current[id],...patch}}));setConfirmed(false);}
  async function preview(){
    setBusy(true);setConfirmed(false);setResults({});setPreviews({});
    try {for(const id of ids){
      const result=await previewRecovery(id,from,to);
      if(result.data){setPreviews(current=>({...current,[id]:result.data!}));setChoices(current=>({...current,[id]:{mode:'all',missedCount:0,missedKeys:[],teacherId:'',parentName:learners.find(s=>s.id===id)?.parents||''}}));}
      else setResults(current=>({...current,[id]:result.error}));
    }setRangePreviewed(rangeKey);}catch{setResults({general:'Preview was interrupted. Please try again.'});}finally{setBusy(false);}
  }
  async function save(){
    setBusy(true);setResults({});
    try {for(const id of ids){
      const result=await saveRecovery({studentId:id,from,to,note,fingerprint:previews[id].fingerprint,...choices[id]});
      setResults(current=>({...current,[id]:result.data?`Saved: ${result.data.attended}/${result.data.sessions} attended; ${result.data.missed} missed. Points adjustment: ${result.data.pointsDelta>0?'+':''}${result.data.pointsDelta}.`:result.error}));
    }}catch{setResults(current=>({...current,general:'Request interrupted. Some learners may already be saved. Refresh reports or retry; duplicate points are prevented.'}));}finally{setBusy(false);setConfirmed(false);}
  }
  return <div className="space-y-5"><fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
    <p>Record what a parent remembers. Preview lists completed sessions with historical attendance or current roster membership; it does not invent dates from the weekly timetable.</p>
    <label className="block font-semibold">Find learners by name, parent or teacher<input className="mt-1 block w-full rounded border p-2" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="max-h-64 overflow-auto rounded border p-3">{filtered.map(student=><label key={student.id} className="mb-2 flex items-start gap-2"><input type="checkbox" checked={ids.includes(student.id)} onChange={e=>{setIds(current=>e.target.checked?[...current,student.id]:current.filter(id=>id!==student.id));setConfirmed(false);}}/><span>{student.name}<small className="block text-slate-500">{student.parents} | {student.teachers.join(', ')}</small></span></label>)}</div>
    <div className="flex flex-wrap gap-4"><label>From<input type="date" className="ml-2 rounded border p-2" value={from} max={today} onChange={e=>{setFrom(e.target.value);setConfirmed(false);}}/></label><label>To<input type="date" className="ml-2 rounded border p-2" value={to} min={from} max={today} onChange={e=>{setTo(e.target.value);setConfirmed(false);}}/></label></div>
    <label className="block">Parent report / evidence<textarea className="mt-1 block w-full rounded border p-2" rows={3} maxLength={4000} value={note} onChange={e=>{setNote(e.target.value);setConfirmed(false);}} placeholder="Example: Nida reports Mustafa attended every class from 1 August; July is uncertain and excluded."/></label>
    <button type="button" disabled={!ids.length} onClick={preview} className="rounded-full bg-slate-800 px-5 py-3 text-white disabled:opacity-40">{busy?'Working...':`Preview ${ids.length} learner(s)`}</button>
    {rangePreviewed===rangeKey&&ids.map(id=>{const data=previews[id],choice=choices[id];if(!data||!choice)return null;const teachers=new Map<string,string>();data.sessions.forEach(s=>s.teacherIds.forEach((tid,i)=>teachers.set(tid,s.teachers[i]??s.teachers.join(', '))));const missed=choice.mode==='count'?choice.missedCount:choice.mode==='dates'?choice.missedKeys.length:0;return <section key={id} className="space-y-3 rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">{learners.find(s=>s.id===id)?.name}</h2><p>{data.sessions.length} completed class requirements; {data.sessions.filter(s=>s.verified).length} verified. Reported attendance: {Math.max(0,data.sessions.length-missed)}/{data.sessions.length}{data.sessions.length?` (${Math.round((data.sessions.length-missed)/data.sessions.length*100)}%)`:''}.</p>{!data.sessions.length?<p>No completed dates were found. Check the learner roster and session records first.</p>:null}
      <label className="block">Reporting parent<input className="ml-2 rounded border p-2" value={choice.parentName} onChange={e=>change(id,{parentName:e.target.value})}/></label>
      <label className="flex gap-2"><input type="checkbox" checked={choice.mode!=='all'} onChange={e=>change(id,{mode:e.target.checked?'count':'all',missedCount:0,missedKeys:[]})}/>Some classes were missed</label>
      {choice.mode!=='all'?<><label>Details available<select className="ml-2 rounded border p-2" value={choice.mode} onChange={e=>change(id,{mode:e.target.value as Choice['mode']})}><option value="count">Number only; dates unknown</option><option value="dates">Specific class dates</option></select></label><label className="block">Teacher (optional)<select className="ml-2 rounded border p-2" value={choice.teacherId} onChange={e=>change(id,{teacherId:e.target.value})}><option value="">Not remembered / any teacher</option>{[...teachers].map(([tid,name])=><option key={tid} value={tid}>{name}</option>)}</select></label>{choice.mode==='count'?<label>Number missed<input className="ml-2 w-24 rounded border p-2" type="number" min={1} max={data.sessions.filter(s=>!s.verified&&(!choice.teacherId||s.teacherIds.includes(choice.teacherId))).length} value={choice.missedCount} onChange={e=>change(id,{missedCount:Number(e.target.value)})}/><p className="text-sm text-slate-600">The period summary and points will reflect this count. No specific lesson will be falsely labeled absent. For accurate monthly percentages, enter separate reports for each month when possible.</p></label>:null}</>:null}
      <details><summary className="cursor-pointer font-semibold">Review dates and teachers{choice.mode==='dates'?' / select missed classes':''}</summary><div className="max-h-80 space-y-2 overflow-auto py-3">{data.sessions.filter(s=>!choice.teacherId||s.teacherIds.includes(choice.teacherId)).map(s=><label key={s.key} className="flex gap-2 rounded border p-2">{choice.mode==='dates'?<input type="checkbox" disabled={s.verified} checked={choice.missedKeys.includes(s.key)} onChange={e=>change(id,{missedKeys:e.target.checked?[...choice.missedKeys,s.key]:choice.missedKeys.filter(key=>key!==s.key)})}/>:null}<span>{s.day} - {s.title} - {s.teachers.join(', ')} {s.verified?'(verified present)':''}</span></label>)}</div></details>
    </section>;})}
    {ready?<><label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the dates and parent reports. Apply these attendance and points corrections.</label><button type="button" disabled={!confirmed||!note.trim()||ids.some(id=>!choices[id]?.parentName.trim())} onClick={save} className="rounded-full bg-green-800 px-5 py-3 text-white disabled:opacity-40">{busy?'Saving...':'Save attendance and points'}</button><p className="text-sm">Saved independently for each learner. Existing awards are retained; only the difference is added or reversed. A report with all classes attended makes this period 100%; other periods retain their own attendance.</p></>:null}
  </fieldset><div role="status" className="space-y-2">{Object.entries(results).map(([id,message])=><p key={id} className="rounded border bg-white p-3">{learners.find(s=>s.id===id)?.name}: {message}</p>)}</div></div>;
}
