"use client";
import { useRef, useState } from "react";
import { calculatePayroll, minutesLabel, type PayrollInput, type PayrollLine, type PayrollSnapshot } from "@/lib/payroll/calculation";
import { PayslipCard } from "./PayslipCard";
const field="w-full rounded-xl border border-[#cbd9e8] bg-white px-3 py-2 text-sm";
export function PayrollEditor({teacherId,teacherName,month,initial,initialVersion,initialId,initialFolder,portalMinutes,publishedAt,templates}:{teacherId:string;teacherName:string;month:string;initial:PayrollInput;initialVersion:number;initialId?:string;initialFolder:string;portalMinutes:number;publishedAt:string|null;templates:Array<{key:string;name:string;lines:PayrollLine[]}>}) {
 const [input,setInput]=useState(initial),[version,setVersion]=useState(initialVersion),[id,setId]=useState(initialId),[folder,setFolder]=useState(initialFolder),[pending,setPending]=useState(false),[message,setMessage]=useState(""),[confirmed,setConfirmed]=useState(false),[removeProof,setRemoveProof]=useState(false);
 const file=useRef<HTMLInputElement>(null);
 const paymentDate=useRef<HTMLInputElement>(null);
 const submitting=useRef(false);
 function update<K extends keyof PayrollInput>(key:K,value:PayrollInput[K]) {setInput(prev=>({...prev,[key]:value}));setConfirmed(false);setMessage("");}
 function line(index:number,key:string,value:string) {setInput(prev=>({...prev,lines:prev.lines.map((l,i)=>i===index?{...l,[key]:key==="sessions"||key==="actualMinutes"?Number(value):value,...(key==="sessions"?{paidHours:value}:{})}:l)}));setConfirmed(false);setMessage("");}
 let preview:PayrollSnapshot|null=null,calculationError="";
 try {preview={...input,teacherName,month,totals:calculatePayroll(input),proof:(input as PayrollSnapshot).proof??null};}catch(error){calculationError=(error as Error).message;}
 async function save(mode:"save"|"publish") {
  if(submitting.current)return;
  if(mode==="publish") {
   if(calculationError){setMessage(calculationError);return;}
   if(!input.paidOn){setMessage("Enter the actual payment date below before publishing.");paymentDate.current?.focus();return;}
   if(!confirmed){setMessage("Tick the confirmation below to confirm this teacher has been paid.");return;}
  }
  submitting.current=true;
  setPending(true);setMessage("");
  try {
   const form=new FormData();form.set("teacherId",teacherId);form.set("month",month);form.set("version",String(version));form.set("mode",mode);form.set("payload",JSON.stringify(input));form.set("folder",folder);form.set("paidConfirmed",confirmed?"yes":"no");form.set("removeProof",removeProof?"yes":"no");
   if(file.current?.files?.[0])form.set("proof",file.current.files[0]);
   const response=await fetch("/api/admin/payroll",{method:"POST",body:form});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"Save failed.");
   setVersion(result.version);setId(result.id);setInput(result.snapshot);setRemoveProof(false);setConfirmed(false);if(file.current)file.current.value="";
   setMessage(result.published?"Published. This payslip is now visible on the teacher's dashboard.":"Draft saved. Unpublished edits are visible only to finance admins.");
  }catch(error){setMessage((error as Error).message||"Connection interrupted. Reload to check the saved version before retrying.");}finally{submitting.current=false;setPending(false);}
 }
 return <div className="space-y-6"><section className="space-y-5 rounded-3xl border border-[#dce4ec] bg-[#f5f8fa] p-5">
  <div><h2 className="text-xl font-semibold">Prepare {teacherName}&apos;s payslip</h2><p className="mt-1 text-sm text-[#617184]">Edit the proposed figures, review the preview, then publish after payment. Portal recorded time: {minutesLabel(portalMinutes)}.</p>{publishedAt&&<p className="mt-1 text-xs text-emerald-800">A published version exists. Saved draft edits will not change it until you publish again.</p>}</div>
  {month==="2026-09"&&<label className="block text-sm font-medium">September reference template (optional)<select className={field+" mt-2"} defaultValue="" disabled={pending} onChange={e=>{const t=templates.find(t=>t.key===e.target.value);if(t){setInput(prev=>({...prev,lines:t.lines.map(l=>({...l})),fxRate:prev.fxRate||"375.116",fxDate:prev.fxDate||"2026-09-14",sourceNote:"September payroll reference, reviewed 2 October 2026"}));setConfirmed(false);}e.target.value="";}}><option value="">Choose only if the template matches this teacher</option>{templates.map(t=><option key={t.key} value={t.key}>{t.name}</option>)}</select></label>}
  <fieldset disabled={pending} className="space-y-4"><legend className="sr-only">Payroll details</legend>
  {input.lines.map((l,i)=><div key={i} className="rounded-2xl border bg-white p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <label className="text-xs font-semibold">Programme<input className={field+" mt-1"} value={l.label} maxLength={120} onChange={e=>line(i,"label",e.target.value)}/></label>
   <label className="text-xs font-semibold">Sessions<input className={field+" mt-1"} type="number" min="0" max="1000" step="1" value={l.sessions} onChange={e=>line(i,"sessions",e.target.value)}/></label>
   <label className="text-xs font-semibold">Paid hours<input className={field+" mt-1"} type="number" min="0" max="1000" step="0.0001" value={l.paidHours} onChange={e=>line(i,"paidHours",e.target.value)}/></label>
   <label className="text-xs font-semibold">Hourly rate (GBP)<input className={field+" mt-1"} type="number" min="0" step="0.00000001" value={l.hourlyRate} onChange={e=>line(i,"hourlyRate",e.target.value)}/></label>
   <label className="text-xs font-semibold">Actual teaching minutes (reference)<input className={field+" mt-1"} type="number" min="0" step="1" value={l.actualMinutes} onChange={e=>line(i,"actualMinutes",e.target.value)}/></label>
   <div className="flex items-end"><button type="button" disabled={input.lines.length===1} onClick={()=>update("lines",input.lines.filter((_,j)=>j!==i))} className="text-sm text-red-700 disabled:opacity-40">Remove programme</button></div>
  </div></div>)}
  <button type="button" onClick={()=>update("lines",[...input.lines,{label:"",sessions:0,paidHours:"0",hourlyRate:"0",actualMinutes:0}])} disabled={input.lines.length>=30} className="rounded-full border bg-white px-4 py-2 text-sm">+ Add programme</button>
  <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Adjustment (GBP, optional)<input className={field} type="number" step="0.01" value={input.adjustment} onChange={e=>update("adjustment",e.target.value)}/></label><label className="text-sm">Adjustment reason<input className={field} value={input.adjustmentReason} maxLength={500} onChange={e=>update("adjustmentReason",e.target.value)}/></label></div>
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.showPkr} onChange={e=>update("showPkr",e.target.checked)}/> Show PKR equivalent alongside pounds</label>
  {input.showPkr&&<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">PKR per GBP<input className={field} type="number" min="0" step="0.000001" value={input.fxRate} onChange={e=>update("fxRate",e.target.value)}/></label><label className="text-sm">Conversion rate date<input className={field} type="date" value={input.fxDate} onChange={e=>update("fxDate",e.target.value)}/></label></div>}
  <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Payment reference (optional)<input className={field} value={input.paymentReference} maxLength={500} onChange={e=>update("paymentReference",e.target.value)}/></label></div>
  <label className="block text-sm">Note for the teacher (optional)<textarea className={field} rows={3} value={input.note} maxLength={2000} onChange={e=>update("note",e.target.value)}/></label>
  <div className="space-y-3 rounded-2xl border border-dashed bg-white p-4"><h3 className="font-semibold">Payment evidence (optional)</h3><label className="block text-sm">This teacher&apos;s existing payroll Drive folder<input className={field} placeholder="https://drive.google.com/drive/folders/..." value={folder} onChange={e=>setFolder(e.target.value)}/></label><p className="text-xs text-[#617184]">Saved for this teacher. Use their private payroll folder accessible by the app&apos;s Drive account.</p><label className="block text-sm">Screenshot or PDF (up to 8 MB)<input ref={file} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-2 block w-full text-sm"/></label>{preview?.proof&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={removeProof} onChange={e=>setRemoveProof(e.target.checked)}/>Remove current receipt from this draft</label>}</div>
  </fieldset>
  <p className="text-xs text-[#617184]">Reference: {input.sourceNote}. GBP rates retain the spreadsheet&apos;s precision so penny totals match.</p>
 </section>
 {calculationError?<p role="alert" className="rounded-xl bg-amber-50 p-4">{calculationError}</p>:preview&&<PayslipCard snapshot={preview} id={id} preview/>}
 <section className="space-y-4 rounded-2xl border bg-white p-5"><h3 className="font-semibold">Publish after payment</h3><label className="block max-w-sm text-sm font-medium">Actual payment date (required to publish)<input ref={paymentDate} className={field+" mt-2"} type="date" value={input.paidOn} disabled={pending} onChange={e=>update("paidOn",e.target.value)} aria-describedby="payroll-publish-help"/></label><p id="payroll-publish-help" className="text-sm text-[#617184]">Enter the date you paid this teacher, tick the confirmation, then select Publish paid payslip. You can publish directly without saving a draft first. A payment screenshot is optional.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={pending} onChange={e=>setConfirmed(e.target.checked)}/>I have paid this teacher and reviewed the amount, payment date and evidence above.</label><div className="flex flex-wrap gap-3"><button type="button" disabled={pending||!!calculationError} onClick={()=>save("save")} className="rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-50">{pending?"Saving...":"Save draft"}</button><button type="button" disabled={pending} onClick={()=>save("publish")} className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending?"Please wait...":"Publish paid payslip"}</button></div>{message&&<p role="status" className="rounded-xl bg-[#f7f4eb] p-3 text-sm">{message}</p>}</section>
 </div>;
}
