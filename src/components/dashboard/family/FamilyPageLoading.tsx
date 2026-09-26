"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function FamilyPageLoading({role}:{role:'parent'|'student'}){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setSlow(true),10000);return()=>clearTimeout(timer);},[]);
 return <main className="min-h-screen bg-[#f7f2ea] p-6"><div className="mx-auto max-w-xl space-y-5 rounded-3xl bg-white p-6"><h1 className="text-xl font-semibold">Opening your page...</h1><p role="status">{slow?'This is taking longer than usual. You can open your classes directly or reload this page.':'Please wait a moment.'}</p><div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full w-1/2 animate-pulse rounded bg-amber-400 motion-reduce:animate-none"/></div><div className="flex flex-wrap gap-3"><Link prefetch={false} href={`/${role}/schedule`} className="min-h-12 rounded-xl bg-[#22304a] px-4 py-3 text-white">Open classes</Link>{slow?<button type="button" onClick={()=>window.location.reload()} className="min-h-12 rounded-xl border px-4 py-3">Reload page</button>:null}</div></div></main>;
}
