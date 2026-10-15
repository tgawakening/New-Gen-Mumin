'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Headphones } from 'lucide-react';
export function RecordingDownloadButtons({recordingId}:{recordingId:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function audio(){
  if(controller.current)return;
  const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setMessage('Preparing MP3…');
  try{
   const response=await fetch(`/api/recordings/${recordingId}/audio`,{signal:abort.signal});
   if(!response.ok){const data=await response.json();throw Error(data.error||'Audio download failed.');}
   setMessage('Downloading audio… keep this page open.');
   const blob=await response.blob();
   if(!blob.size)throw Error('No audio was returned. Please retry.');
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'class-recording.mp3';
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   setMessage('MP3 ready. Check your browser downloads.');
  }catch(e){setMessage('');if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Download interrupted. Please retry.');}
  finally{controller.current=null;setBusy(false);}
 }
 return <div className="flex max-w-sm flex-wrap items-center gap-2">
  <a href={`/api/recordings/${recordingId}/download`} download className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#0f4d81]"><Download size={14} className="mr-1 inline"/>Download video</a>
  <button disabled={busy} onClick={()=>void audio()} className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#0f4d81] disabled:opacity-50"><Headphones size={14} className="mr-1 inline"/>{busy?'Preparing / downloading…':'Download MP3'}</button>
  {busy&&<button className="text-xs underline" onClick={()=>controller.current?.abort()}>Cancel</button>}
  {message&&<p role="status" className="w-full text-xs text-slate-600">{message}</p>}{error&&<p role="alert" className="w-full text-xs text-red-700">{error}</p>}
 </div>;
}
