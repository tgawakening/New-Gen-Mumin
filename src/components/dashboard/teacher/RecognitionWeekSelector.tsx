"use client";
import { useState } from "react";
import { recognitionMonthWeeks } from "@/lib/community/recognition-week";
export function RecognitionWeekSelector({currentWeek,currentMonth}:{currentWeek:string;currentMonth:string}) {
 const [month,setMonth]=useState(currentMonth),[week,setWeek]=useState(currentWeek);
 const options=recognitionMonthWeeks(month,currentWeek);
 function choose(value:string){setMonth(value.slice(0,7));setWeek(value);}
 const last=new Date(currentWeek+"T00:00:00Z");last.setUTCDate(last.getUTCDate()-7);
 return <fieldset className="grid gap-3 rounded-2xl border border-[#d8e3ed] bg-[#f8fafc] p-4 lg:col-span-2"><legend className="px-2 text-sm font-bold text-[#22304a]">Certificate week</legend><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{setMonth(currentMonth);setWeek(currentWeek);}} className="rounded-full border bg-white px-4 py-2 text-sm">This week</button><button type="button" onClick={()=>choose(last.toISOString().slice(0,10))} className="rounded-full border bg-white px-4 py-2 text-sm">Last week</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Month<input type="month" required value={month} max={currentMonth} onChange={e=>{const m=e.target.value;setMonth(m);setWeek(recognitionMonthWeeks(m,currentWeek).at(-1)?.value??"");}} className="rounded-xl border bg-white px-3 py-3 font-normal"/></label><label className="grid gap-2 text-sm font-bold">Week of month<select name="featuredWeek" required value={week} onChange={e=>setWeek(e.target.value)} className="rounded-xl border bg-white px-3 py-3 font-normal">{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><p className="text-xs text-[#617184]">Weeks run Monday to Sunday (Pakistan time). The date range will appear on the certificate. A week crossing two months is the same award period.</p></fieldset>;
}
