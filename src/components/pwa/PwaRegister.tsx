"use client";
import { useEffect, useState } from "react";
export function PwaRegister(){
 const [update,setUpdate]=useState(false);
 useEffect(()=>{
  if(!('serviceWorker' in navigator)||process.env.NODE_ENV!=='production')return;
  const previouslyControlled=Boolean(navigator.serviceWorker.controller);
  const changed=()=>{if(previouslyControlled)setUpdate(true);};
  navigator.serviceWorker.addEventListener('controllerchange',changed);
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>undefined);
  return()=>navigator.serviceWorker.removeEventListener('controllerchange',changed);
 },[]);
 if(!update)return null;
 return <div role="status" className="fixed left-3 right-3 top-3 z-[100] mx-auto max-w-lg rounded-2xl border bg-white p-4 text-[#22304a] shadow-xl"><p className="text-sm">An update is ready. Save your work before reloading.</p><div className="mt-2 flex gap-3"><button type="button" className="min-h-11 rounded-xl bg-[#22304a] px-4 text-white" onClick={()=>window.location.reload()}>Reload now</button><button type="button" className="min-h-11 rounded-xl border px-4" onClick={()=>setUpdate(false)}>Later</button></div></div>;
}
