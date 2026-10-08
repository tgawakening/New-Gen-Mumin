"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
// Used only for the first portal load. The persistent Suspense boundary retains
// the existing page during subsequent navigation transitions.
export function FamilyPageLoading({role}:{role:'parent'|'student'}){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setSlow(true),12000);return()=>clearTimeout(timer);},[]);
 return <main aria-busy="true" className="min-h-screen bg-[#f7f2ea] px-4 py-6"><div className="mx-auto max-w-6xl"><div className="rounded-3xl bg-[#22304a] p-6 text-white"><p className="font-semibold">Gen-Mumin</p><p role="status" className="mt-2 text-sm text-white/80">Loading your portal...</p></div><div aria-hidden="true" className="mt-5 grid animate-pulse gap-4 motion-reduce:animate-none sm:grid-cols-3">{[1,2,3].map(item=><div key={item} className="h-28 rounded-2xl bg-white"/>)}</div>{slow && <div role="status" className="mt-5 rounded-2xl bg-white p-4 text-sm text-[#22304a]">This connection is taking longer than usual.<div className="mt-3 flex gap-4"><Link prefetch={false} href={`/${role}/schedule`} className="underline">Open classes</Link><button type="button" onClick={()=>window.location.reload()} className="underline">Reload</button></div></div>}</div></main>;
}
