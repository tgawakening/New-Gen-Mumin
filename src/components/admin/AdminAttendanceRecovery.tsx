"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveRecovery } from "@/app/admin/attendance/actions";
import { requestAttendancePreview } from "@/lib/live-classes/attendance-preview-client";
import type { RecoveryInput } from "@/lib/live-classes/admin-attendance";
type Learner = { id: string; name: string; parents: string; teachers: string[] };
type Preview = NonNullable<Awaited<ReturnType<typeof requestAttendancePreview>>['data']>;
type Choice = { mode: RecoveryInput['mode']; missedCount: number; missedKeys: string[]; teacherId: string; programId?: string; parentName: string };
export function AdminAttendanceRecovery({ learners, today }: { learners: Learner[]; today: string }) {
  const router=useRouter();
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
  function defaultChoice(id:string):Choice{return {mode:'all',missedCount:0,missedKeys:[],teacherId:'',programId:'',parentName:learners.find(s=>s.id===id)?.parents||''};}
  function change(id:string,patch:Partial<Choice>){setChoices(current=>({...current,[id]:{...(current[id]??defaultChoice(id)),...patch}}));setConfirmed(false);}
  async function preview(){
    setBusy(true);setConfirmed(false);setResults({});if(rangePreviewed!==rangeKey)setPreviews({});
    try {for(const id of ids){
      if(rangePreviewed===rangeKey&&ids.some(key=>!previews[key])&&previews[id])continue;
      const result=await requestAttendancePreview(id,from,to);
      if(result.data){setPreviews(current=>({...current,[id]:result.data!}));setChoices(current=>{const choice=current[id]??defaultChoice(id);return {...current,[id]:{...choice,missedKeys:choice.missedKeys.filter(key=>result.data!.sessions.some(s=>s.key===key&&!s.verified))}};});}
      else setResults(current=>({...current,[id]:result.error}));
    }setRangePreviewed(rangeKey);}catch{setRangePreviewed(rangeKey);setResults(current=>({...current,general:'Preview could not finish. Successfully loaded learners are retained. Retry Preview to load the remaining learners.'}));}finally{setBusy(false);}
  }
  async function save(){
    if(busy)return;
    if(!ready){setResults({general:'Preview the selected learners and date range before saving.'});return;}
    if(!note.trim()){
      setResults({general:'Please enter a parent report / evidence. For example: Parent confirms all classes attended in the selected period.'});
      document.getElementById('attendance-report-note')?.focus();return;
    }
    const missingParent=ids.find(id=>!choices[id]?.parentName.trim());
    if(missingParent){
      setResults({general:'Please enter the reporting parent for '+learners.find(student=>student.id===missingParent)?.name+'.'});
      document.getElementById('attendance-parent-'+missingParent)?.focus();return;
    }
    if(!confirmed){setResults({general:'Please tick the review checkbox, then click Save attendance and points.'});return;}
    setBusy(true);setResults({});
    try {for(const id of ids){
      const result=await saveRecovery({studentId:id,from,to,note,fingerprint:previews[id].fingerprint,...choices[id]});
      setResults(current=>({...current,[id]:result.data?`Saved: ${result.data.attended}/${result.data.sessions} attended; ${result.data.missed} missed. Points adjustment: ${result.data.pointsDelta>0?'+':''}${result.data.pointsDelta}.`:result.error}));
    }}catch{setResults(current=>({...current,general:'Request interrupted. Some learners may already be saved. Refresh reports or retry; duplicate points are prevented.'}));}finally{setBusy(false);setConfirmed(false);router.refresh();}
  }
  return <div className="space-y-5"><fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
    <p>Record what a parent remembers. Preview lists completed sessions with historical attendance or current roster membership; it does not invent dates from the weekly timetable.</p>
    <label className="block font-semibold">Find learners by name, parent or teacher<input className="mt-1 block w-full rounded border p-2" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="max-h-64 overflow-auto rounded border p-3">{filtered.map(student=><label key={student.id} className="mb-2 flex items-start gap-2"><input type="checkbox" checked={ids.includes(student.id)} onChange={e=>{setIds(current=>e.target.checked?[...current,student.id]:current.filter(id=>id!==student.id));if(e.target.checked)setChoices(current=>({...current,[student.id]:current[student.id]??defaultChoice(student.id)}));setConfirmed(false);}}/><span>{student.name}<small className="block text-slate-500">{student.parents} | {student.teachers.join(', ')}</small></span></label>)}</div>
    <div className="flex flex-wrap gap-4"><label>From<input type="date" className="ml-2 rounded border p-2" value={from} max={today} onChange={e=>{setFrom(e.target.value);setConfirmed(false);}}/></label><label>To<input type="date" className="ml-2 rounded border p-2" value={to} min={from} max={today} onChange={e=>{setTo(e.target.value);setConfirmed(false);}}/></label></div>
    <label className="block">Parent report / evidence (required)<textarea id="attendance-report-note" className="mt-1 block w-full rounded border p-2" rows={3} maxLength={4000} value={note} onChange={e=>{setNote(e.target.value);setConfirmed(false);}} placeholder="Example: Nida reports Mustafa attended every class from 1 August; July is uncertain and excluded."/></label>
    <p><strong>Preview does not save attendance.</strong> Choose attendance, enter the parent report, preview the sessions, then tick the review checkbox and click Save attendance and points. Only a Saved message confirms the update.</p>
    {ids.map(id=>{const data=rangePreviewed===rangeKey?previews[id]:undefined,choice=choices[id]??defaultChoice(id);const teachers=new Map<string,string>();data?.sessions.forEach(s=>s.teacherIds.forEach((tid,i)=>teachers.set(tid,s.teachers[i]??s.teachers.join(', '))));const programmes=new Map<string,string>();data?.sessions.forEach(s=>s.programs?.forEach(programme=>programmes.set(programme.id,programme.title)));const missed=choice.mode==='count'?choice.missedCount:choice.mode==='dates'?choice.missedKeys.length:0;return <section key={id} className="space-y-3 rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">{learners.find(s=>s.id===id)?.name}</h2>
      <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Attendance from {from} to {to}</legend>
        <label className="flex items-center gap-2"><input type="radio" name={`attendance-${id}`} checked={choice.mode==='all'} onChange={()=>change(id,{mode:'all'})}/>Attended all classes</label>
        <label className="flex items-center gap-2"><input type="radio" name={`attendance-${id}`} checked={choice.mode==='count'} onChange={()=>change(id,{mode:'count',missedCount:choice.missedCount||1})}/>Missed some classes - number only</label>
        <label className="flex items-center gap-2"><input type="radio" name={`attendance-${id}`} checked={choice.mode==='dates'} onChange={()=>change(id,{mode:'dates'})}/>Missed specific class dates</label>
      </fieldset>
      {choice.mode==='all'?<p className="text-sm text-slate-600">All eligible sessions in this period will be marked present, with 5 points per class and no duplicate awards.</p>:null}
      <label className="block">Reporting parent (required)<input id={`attendance-parent-${id}`} className="ml-2 rounded border p-2" value={choice.parentName} onChange={e=>change(id,{parentName:e.target.value})}/></label>
      {choice.mode!=='all'&&data?<label className="block">Programme (optional)<select className="ml-2 rounded border p-2" value={choice.programId??''} onChange={e=>change(id,{programId:e.target.value})}><option value="">Not remembered / any programme</option>{[...programmes].map(([pid,title])=><option key={pid} value={pid}>{title}</option>)}</select><span className="block text-sm text-slate-600">For number-only reports, missed classes come from this programme. For specific dates, this filters the list; previously selected dates remain selected.</span></label>:null}
      {choice.mode!=='all'&&data?<label className="block">Teacher (optional)<select className="ml-2 rounded border p-2" value={choice.teacherId} onChange={e=>change(id,{teacherId:e.target.value})}><option value="">Not remembered / any teacher</option>{[...teachers].map(([tid,name])=><option key={tid} value={tid}>{name}</option>)}</select></label>:null}
      {choice.mode==='count'?<div><label>Number missed<input className="ml-2 w-24 rounded border p-2" type="number" min={1} max={data?.sessions.filter(s=>!s.verified&&(!choice.teacherId||s.teacherIds.includes(choice.teacherId))&&(!choice.programId||s.programs.some(p=>p.id===choice.programId))).length??500} value={choice.missedCount} onChange={e=>change(id,{missedCount:Number(e.target.value)})}/></label><p className="text-sm text-slate-600">The period summary and points will reflect this count. No specific lesson will be falsely labeled absent. For accurate monthly percentages, enter separate reports for each month when possible.</p></div>:null}
      {!data?<p className="text-sm text-slate-600">Preview below to load sessions and teachers{choice.mode==='dates'?' and select the missed dates':''} before saving.</p>:<>
        <p>{data.sessions.length} completed class requirements; {data.sessions.filter(s=>s.verified).length} verified. Preview only - attendance after saving: {Math.max(0,data.sessions.length-missed)}/{data.sessions.length}{data.sessions.length?` (${Math.max(0,Math.round((data.sessions.length-missed)/data.sessions.length*100))}%)`:''}.</p>
        {!data.sessions.length?<p>No completed dates were found. Check the learner roster and session records first.</p>:null}
        <details open={choice.mode==='dates'?true:undefined}><summary className="cursor-pointer font-semibold">Review dates and teachers{choice.mode==='dates'?' / select missed classes':''}</summary><div className="max-h-80 space-y-2 overflow-auto py-3">{data.sessions.filter(s=>(!choice.teacherId||s.teacherIds.includes(choice.teacherId))&&(!choice.programId||s.programs.some(p=>p.id===choice.programId))).map(s=><label key={s.key} className="flex gap-2 rounded border p-2">{choice.mode==='dates'?<input type="checkbox" disabled={s.verified} checked={choice.missedKeys.includes(s.key)} onChange={e=>change(id,{missedKeys:e.target.checked?[...choice.missedKeys,s.key]:choice.missedKeys.filter(key=>key!==s.key)})}/>:null}<span>{s.day} - {s.title} - {s.programs?.map(p=>p.title).join(', ')} - {s.teachers.join(', ')} {s.verified?'(verified present)':''}</span></label>)}</div></details>
      </>}
    </section>;})}
    <button type="button" disabled={!ids.length} onClick={preview} className="rounded-full bg-slate-800 px-5 py-3 text-white disabled:opacity-40">{busy?'Working...':`Preview ${ids.length} learner(s)`}</button>
    {ready?<><div className="rounded border border-amber-300 bg-amber-50 p-3" role="status"><strong>Preview loaded. Attendance has not been saved by this preview.</strong><ul className="mt-2 list-disc pl-5">{!note.trim()?<li>Enter a parent report / evidence above (for example: Parent confirms all classes attended in this period).</li>:null}{ids.filter(id=>!choices[id]?.parentName.trim()).map(id=><li key={id}>Enter the reporting parent for {learners.find(s=>s.id===id)?.name}.</li>)}{!confirmed?<li>Tick the review checkbox below before saving.</li>:null}</ul></div><label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the dates and parent reports. Apply these attendance and points corrections.</label><button type="button" disabled={busy} onClick={save} className="rounded-full bg-green-800 px-5 py-3 text-white disabled:opacity-40">{busy?'Saving...':'Save attendance and points'}</button><p className="text-sm">Saved independently for each learner. Existing awards are retained; only the difference is added or reversed. A report with all classes attended makes this period 100%; other periods retain their own attendance.</p></>:null}
  </fieldset><div role="status" className="space-y-2">{Object.entries(results).map(([id,message])=><p key={id} className="rounded border bg-white p-3">{id==='general'?'':`${learners.find(s=>s.id===id)?.name??'Learner'}: `}{message}</p>)}</div></div>;
}
