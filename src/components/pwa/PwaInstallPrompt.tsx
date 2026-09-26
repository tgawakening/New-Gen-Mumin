"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
function subscribeStandalone(callback:()=>void){const media=window.matchMedia('(display-mode: standalone)');media.addEventListener('change',callback);return()=>media.removeEventListener('change',callback);}
function standaloneSnapshot(){return window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);}
export function PwaInstallPrompt({force=false}:{audience?:'dashboard'|'parent'|'teacher'|'student';force?:boolean}){
 const standalone=useSyncExternalStore(subscribeStandalone,standaloneSnapshot,()=>false);
 const [event,setEvent]=useState<InstallEvent|null>(null);
 const [installed,setInstalled]=useState(false);
 const [dismissed,setDismissed]=useState(false);
 const [help,setHelp]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const ready=(value:Event)=>{value.preventDefault();setEvent(value as InstallEvent);};
  const done=()=>{setInstalled(true);setEvent(null);};
  window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);
  return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);};
 },[]);
 if(standalone||installed||dismissed&&!force)return null;
 async function install(){
  setHelp(true);
  if(!event)return;
  try{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')setInstalled(true);setEvent(null);}catch{setMessage('Use the browser steps below to add Gen-Mumin.');}
 }
 return <section className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-3 text-white">
  <div className="flex items-center justify-between gap-2"><button type="button" onClick={install} aria-expanded={help} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" aria-hidden="true"/>Add Gen-Mumin to your phone</button>{!force?<button type="button" onClick={()=>setDismissed(true)} aria-label="Dismiss home screen help" className="flex h-11 w-11 items-center justify-center"><X className="h-4 w-4"/></button>:null}</div>
  {help?<div className="space-y-2 border-t border-white/15 pt-3 text-sm leading-6"><p>Add it directly from your browser. You do not need to search an app store for this home-screen version.</p><p><strong>iPhone / iPad:</strong> Open genmumin.com in Safari, tap Share, then Add to Home Screen.</p><p><strong>Android:</strong> Open genmumin.com in Chrome, tap the three-dot menu, then Add to Home screen or Install app.</p><p>If you opened a link inside WhatsApp, open it in your phone browser first. An internet connection is needed for classes and saving work.</p>{message?<p role="status">{message}</p>:null}<button type="button" onClick={()=>setHelp(false)} className="min-h-11 underline">Close instructions</button></div>:null}
 </section>;
}
