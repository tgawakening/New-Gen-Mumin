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
  const [rangePreviewed,setRangePreviewed]=useState('');
  const rangeKey=`${from}:${to}`;
  const filtered=learners.filter(student=>`${student.name} ${student.parents} ${student.teachers.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  function defaultChoice(id:string):Choice{return {mode:'all',missedCount:0,missedKeys:[],teacherId:'',programId:'',parentName:learners.find(s=>s.id===id)?.parents||''};}
  function change(id:string,patch:Partial<Choice>){setChoices(current=>({...current,[id]:{...(current[id]??defaultChoice(id)),...patch}}));}
  async function loadSessions(id:string){
    setBusy(true);
    try {
      const result=await requestAttendancePreview(id,from,to);
      if(result.data){setPreviews(current=>rangePreviewed===rangeKey?{...current,[id]:result.data!}:{[id]:result.data!});setRangePreviewed(rangeKey);setResults(current=>({...current,[id]:''}));}
      else setResults(current=>({...current,[id]:result.error}));
    }finally{setBusy(false);}
  }
  function selectMode(id:string,mode:Choice['mode']){
    change(id,{mode,...(mode==='count'?{missedCount:choices[id]?.missedCount||1}:{})});
    if(mode!=='all'&&(rangePreviewed!==rangeKey||!previews[id]))void loadSessions(id);
  }
  async function save(){
    if(busy||!ids.length)return;
    if(!from||!to||from>to||to>today){setResults({general:'Choose a valid date range ending today or earlier.'});return;}
    setBusy(true);setResults({});
    try {for(const id of ids){
      try {
        const choice=choices[id]??defaultChoice(id);
        if(choice.mode==='dates'&&(rangePreviewed!==rangeKey||!choice.missedKeys.length)){
          setResults(current=>({...current,[id]:'Select the missed dates for this period, or choose All attended.'}));continue;
        }
        const preview=await requestAttendancePreview(id,from,to);
        if(!preview.data){setResults(current=>({...current,[id]:preview.error}));continue;}
        if(!preview.data.sessions.length){setResults(current=>({...current,[id]:'No completed classes found in this period. Nothing was changed.'}));continue;}
        const result=await saveRecovery({studentId:id,from,to,...choice,parentName:choice.parentName.trim()||'Admin record',note:note.trim()||('Admin recorded attendance: '+(choice.mode==='all'?'all classes attended':choice.mode==='count'?choice.missedCount+' classes missed; dates unknown':'specific missed dates selected')+'.'),fingerprint:preview.data.fingerprint});
        setResults(current=>({...current,[id]:result.data?`Saved: ${result.data.attended}/${result.data.sessions} attended; ${result.data.missed} missed. Points adjustment: ${result.data.pointsDelta>0?'+':''}${result.data.pointsDelta}.`:result.error}));
      }catch{setResults(current=>({...current,[id]:'Save could not be confirmed. Retry safely; duplicate points are prevented.'}));}
    }}finally{setBusy(false);router.refresh();}
  }
  return <div className="space-y-5"><fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
    <h2 className="text-2xl font-bold">Update attendance</h2><p>Select children, choose the period, then save. All attended is selected by default.</p>
    <label className="block font-semibold">Find learners by name, parent or teacher<input className="mt-1 block w-full rounded border p-2" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="max-h-64 overflow-auto rounded border p-3">{filtered.map(student=><label key={student.id} className="mb-2 flex items-start gap-2"><input type="checkbox" checked={ids.includes(student.id)} onChange={e=>{setIds(current=>e.target.checked?[...current,student.id]:current.filter(id=>id!==student.id));if(e.target.checked)setChoices(current=>({...current,[student.id]:current[student.id]??defaultChoice(student.id)}));}}/><span>{student.name}<small className="block text-slate-500">{student.parents} | {student.teachers.join(', ')}</small></span></label>)}</div>
    <div className="flex flex-wrap gap-4"><label>From<input type="date" className="ml-2 rounded border p-2" value={from} max={today} onChange={e=>{setFrom(e.target.value);}}/></label><label>To<input type="date" className="ml-2 rounded border p-2" value={to} min={from} max={today} onChange={e=>{setTo(e.target.value);}}/></label></div>
    <label className="block">Notes (optional)<textarea id="attendance-report-note" className="mt-1 block w-full rounded border p-2" rows={3} maxLength={4000} value={note} onChange={e=>{setNote(e.target.value);}} placeholder="Example: Nida reports Mustafa attended every class from 1 August; July is uncertain and excluded."/></label>
    {ids.map(id=>{const data=rangePreviewed===rangeKey?previews[id]:undefined,choice=choices[id]??defaultChoice(id);const teachers=new Map<string,string>();data?.sessions.forEach(s=>s.teacherIds.forEach((tid,i)=>teachers.set(tid,s.teachers[i]??s.teachers.join(', '))));const programmes=new Map<string,string>();data?.sessions.forEach(s=>s.programs?.forEach(programme=>programmes.set(programme.id,programme.title)));const missed=choice.mode==='count'?choice.missedCount:choice.mode==='dates'?choice.missedKeys.length:0;return <section key={id} className="space-y-3 rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">{learners.find(s=>s.id===id)?.name}</h2>
      <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Attendance from {from} to {to}</legend>
        <label className="flex items-center gap-2"><input type="radio" name={`attendance-${id}`} checked={choice.mode==='all'} onChange={()=>selectMode(id,'all')}/>Attended all classes</label>
        <label className="flex items-center gap-2"><input type="radio" name={`attendance-${id}`} checked={choice.mode==='count'} onChange={()=>selectMode(id,'count')}/>Missed some classes - number only</label>
        <label className="flex items-center gap-2"><input type="radio" name={`attendance-${id}`} checked={choice.mode==='dates'} onChange={()=>selectMode(id,'dates')}/>Missed specific class dates</label>
      </fieldset>
      {choice.mode==='all'?<p className="text-sm text-slate-600">All eligible sessions in this period will be marked present, with 5 points per class and no duplicate awards.</p>:null}
      <details><summary className="cursor-pointer text-sm">Parent details (optional)</summary><label className="block">Reporting parent (optional)<input id={`attendance-parent-${id}`} className="ml-2 rounded border p-2" value={choice.parentName} onChange={e=>change(id,{parentName:e.target.value})}/></label></details>
      {choice.mode!=='all'&&data?<label className="block">Programme (optional)<select className="ml-2 rounded border p-2" value={choice.programId??''} onChange={e=>change(id,{programId:e.target.value})}><option value="">Not remembered / any programme</option>{[...programmes].map(([pid,title])=><option key={pid} value={pid}>{title}</option>)}</select><span className="block text-sm text-slate-600">For number-only reports, missed classes come from this programme. For specific dates, this filters the list; previously selected dates remain selected.</span></label>:null}
      {choice.mode!=='all'&&data?<label className="block">Teacher (optional)<select className="ml-2 rounded border p-2" value={choice.teacherId} onChange={e=>change(id,{teacherId:e.target.value})}><option value="">Not remembered / any teacher</option>{[...teachers].map(([tid,name])=><option key={tid} value={tid}>{name}</option>)}</select></label>:null}
      {choice.mode==='count'?<div><label>Number missed<input className="ml-2 w-24 rounded border p-2" type="number" min={1} max={data?.sessions.filter(s=>!s.verified&&(!choice.teacherId||s.teacherIds.includes(choice.teacherId))&&(!choice.programId||s.programs.some(p=>p.id===choice.programId))).length??500} value={choice.missedCount} onChange={e=>change(id,{missedCount:Number(e.target.value)})}/></label><p className="text-sm text-slate-600">The period summary and points will reflect this count. No specific lesson will be falsely labeled absent. For accurate monthly percentages, enter separate reports for each month when possible.</p></div>:null}
      {!data?(choice.mode!=='all'?<button type="button" className="underline" onClick={()=>loadSessions(id)}>Load programmes and session dates</button>:null):<>
        <p className="text-sm">{data.sessions.length} completed classes in this period. {missed} selected as missed. Changes apply when you save.</p>
        {!data.sessions.length?<p>No completed dates were found. Check the learner roster and session records first.</p>:null}
        <details open={choice.mode==='dates'?true:undefined}><summary className="cursor-pointer font-semibold">Review dates and teachers{choice.mode==='dates'?' / select missed classes':''}</summary><div className="max-h-80 space-y-2 overflow-auto py-3">{data.sessions.filter(s=>(!choice.teacherId||s.teacherIds.includes(choice.teacherId))&&(!choice.programId||s.programs.some(p=>p.id===choice.programId))).map(s=><label key={s.key} className="flex gap-2 rounded border p-2">{choice.mode==='dates'?<input type="checkbox" disabled={s.verified} checked={choice.missedKeys.includes(s.key)} onChange={e=>change(id,{missedKeys:e.target.checked?[...choice.missedKeys,s.key]:choice.missedKeys.filter(key=>key!==s.key)})}/>:null}<span>{s.day} - {s.title} - {s.programs?.map(p=>p.title).join(', ')} - {s.teachers.join(', ')} {s.verified?'(verified present)':''}</span></label>)}</div></details>
      </>}
    </section>;})}
    <button type="button" disabled={busy||!ids.length} onClick={save} className="rounded-full bg-green-800 px-5 py-3 text-white disabled:opacity-40">{busy?'Please wait...':'Save attendance and points'}</button>
    <p className="text-sm">Saving applies attendance to eligible completed classes in this period and adds any missing attendance points. Wait for a Saved message for each child. Existing points are not duplicated.</p>
  </fieldset><div role="status" className="space-y-2">{Object.entries(results).map(([id,message])=><p key={id} className="rounded border bg-white p-3">{id==='general'?'':`${learners.find(s=>s.id===id)?.name??'Learner'}: `}{message}</p>)}</div></div>;
}
