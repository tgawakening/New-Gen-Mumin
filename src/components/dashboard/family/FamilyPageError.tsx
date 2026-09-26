"use client";
import Link from "next/link";
import { useEffect } from "react";
export function FamilyPageError({error,reset,role}:{error:Error&{digest?:string};reset:()=>void;role:'parent'|'student'}){
 useEffect(()=>{console.error('Family page could not load',error);},[error]);
 return <main className="min-h-screen bg-[#f7f2ea] p-6"><section className="mx-auto max-w-xl space-y-4 rounded-3xl border bg-white p-6"><h1 className="text-2xl font-semibold">This page could not load</h1><p>Try again, or open classes directly. If you just submitted work, check whether it saved before submitting again.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={reset} className="min-h-12 rounded-xl bg-[#22304a] px-4 py-3 text-white">Try again</button><Link prefetch={false} href={`/${role}/schedule`} className="min-h-12 rounded-xl border px-4 py-3">Open classes</Link><button type="button" onClick={()=>window.location.reload()} className="min-h-12 rounded-xl border px-4 py-3">Reload page</button></div>{error.digest?<p className="text-xs">Support reference: {error.digest}</p>:null}</section></main>;
}
