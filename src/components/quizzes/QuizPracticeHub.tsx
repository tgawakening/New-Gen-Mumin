'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Clock, RotateCcw, Trophy, CheckCircle2, XCircle } from 'lucide-react';
import type { PracticeView } from '@/lib/quizzes/practice-protocol';
import { QuizQuestionImage } from './QuizQuestionImage';
type Entry = { id:string; title:string; attempts:Array<{ id:string; score:number; correctCount:number; questionCount:number; finishedAt:string|null; startedAt:string }> };
const button = 'rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50';
async function request(url:string, body?:unknown) {
 const response = await fetch(url,{ method:body ? 'POST':'GET', cache:'no-store', headers:body ? {'Content-Type':'application/json'}:undefined, body:body ? JSON.stringify(body):undefined, signal:AbortSignal.timeout(20000) });
 const data = await response.json();
 if (!response.ok) throw Error(data.error || 'Please try again.');
 return data;
}
export function QuizPracticeHub({ studentId }: { studentId:string }) {
 const [library,setLibrary] = useState<Entry[]|null>(null), [round,setRound] = useState<PracticeView|null>(null);
 const [error,setError] = useState(''),[busy,setBusy] = useState(false),[answer,setAnswer] = useState(''),[seconds,setSeconds] = useState(0);
 const locked = useRef(false), offset = useRef(0), expirySent = useRef('');
 const load = useCallback(async()=>{ try { setLibrary(await request(`/api/quizzes/practice?studentId=${encodeURIComponent(studentId)}`)); } catch { setError('Practice could not load. Please try again.'); } },[studentId]);
 useEffect(()=>{ void load(); },[load]);
 const accept = useCallback((value:PracticeView)=>{ offset.current=value.serverNow-Date.now();setRound(value);setAnswer('');setSeconds(Math.max(0,Math.ceil((value.deadline-value.serverNow)/1000))); },[]);
 const act = useCallback(async(action:string,extra:Record<string,string>={})=>{
  if(locked.current)return;
  locked.current=true;setBusy(true);setError('');
  try {
   const value:PracticeView=await request('/api/quizzes/practice',{studentId,action,id:round?.id,questionId:round?.question?.id,answer,...extra});
   accept(value);if(value.finished)void load();
  } catch(e){setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message:'Connection interrupted. Retry safely; your answer will not be counted twice.');}
  finally{locked.current=false;setBusy(false);}
 },[studentId,round,answer,accept,load]);
 useEffect(()=>{
  if(!round || round.finished || round.response)return;
  const tick=()=>setSeconds(Math.max(0,Math.ceil((round.deadline-Date.now()-offset.current)/1000)));
  tick();const timer=setInterval(tick,250);return()=>clearInterval(timer);
 },[round]);
 useEffect(()=>{
  if(round && !round.finished && !round.response && seconds===0 && !busy && expirySent.current!==`${round.id}:${round.question?.id}`){expirySent.current=`${round.id}:${round.question?.id}`;void act('answer',{answer:''});}
 },[round,seconds,busy,act]);
 async function openResult(id:string){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{accept(await request(`/api/quizzes/practice?studentId=${encodeURIComponent(studentId)}&id=${encodeURIComponent(id)}`));}catch{setError('Unable to open this result. Please retry.');}finally{locked.current=false;setBusy(false);}}
 const bestTotal=(library??[]).reduce((sum,q)=>sum+Math.max(0,...q.attempts.filter(a=>a.finishedAt).map(a=>a.score)),0);
 return <section className="rounded-[28px] border border-[#eadfce] bg-white p-5 sm:p-7" aria-label="Quiz practice">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#a56724]"><BookOpen size={18}/> Practice playground</p><h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Play past quizzes again</h2></div><span className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-[#22304a]"><Trophy size={20}/> {bestTotal} personal practice points</span></div>
  <p className="my-3 text-sm text-slate-600">Practise completed live quizzes at your own pace, one timed question at a time. Your best scores stay here; practice does not change Qabila points or notify teachers.</p>
  {error&&<p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error} {!round&&<button onClick={()=>{setError('');void load();}} className="ml-2 underline">Retry</button>}</p>}
  {round ? <div className="mt-5 rounded-2xl bg-[#fbf6ef] p-4 sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">{round.title}</h3><button disabled={busy} className="text-sm underline" onClick={()=>{setRound(null);void load();}}>Back to practice library</button></div>
   {round.finished ? <><h4 className="mt-4 text-2xl font-bold text-emerald-800">Practice complete!</h4><p className="mt-2">{round.score} practice points | {round.correctCount} correct | {round.questionCount-round.correctCount} incorrect / unanswered</p><p className="mt-2 text-sm text-slate-600">Your result is saved. Review each answer below, or return to the library to play again.</p><div className="mt-4 space-y-3">{round.answers.map((a,i)=><div key={a.questionId} className="rounded-xl bg-white p-4"><p className="flex items-start gap-2 font-semibold">{a.correct?<CheckCircle2 className="shrink-0 text-emerald-600" size={20}/>:<XCircle className="shrink-0 text-rose-600" size={20}/>} {i+1}. {a.prompt}</p><p className="mt-2 text-sm">Your answer: {a.timedOut?'Time ended':a.answer||'No answer'}</p><p className="mt-1 text-sm text-emerald-800">Correct answer: {a.correctAnswer}</p><p className="mt-1 text-xs">{a.points} practice points</p></div>)}</div></> : <>
    <div className="my-4 flex items-center justify-between gap-3 text-sm"><span>Question {round.questionNumber} of {round.questionCount}</span><span role="timer" className={`flex items-center gap-2 rounded-full px-3 py-2 font-bold ${seconds<=10?'bg-rose-100 text-rose-800':'bg-white'}`}><Clock size={16}/>{round.response?'Answered':`${seconds}s`}</span></div>
    <progress className="mb-4 h-2 w-full accent-amber-500" value={round.questionNumber} max={round.questionCount}/>
    <h4 className="text-lg font-semibold">{round.question?.prompt}</h4>
    {round.question?.image&&<QuizQuestionImage meta={{imageDataUrl:round.question.image}}/>}
    {!round.response ? <form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();void act('answer');}}>
     {round.question?.choices.length ? <fieldset disabled={busy||seconds===0} className="grid gap-3 sm:grid-cols-2"><legend className="sr-only">Choose an answer</legend>{round.question.choices.map((choice,i)=><label key={i} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${answer===choice?'border-amber-500 bg-amber-50':'border-slate-200 bg-white'}`}><input type="radio" name="practice-answer" checked={answer===choice} onChange={()=>setAnswer(choice)}/><span>{choice}</span></label>)}</fieldset>:<label className="block text-sm">Your answer<input maxLength={2000} value={answer} onChange={e=>setAnswer(e.target.value)} disabled={busy||seconds===0} className="mt-2 block w-full rounded-xl border bg-white p-3"/></label>}
     <button className={button} disabled={busy||(!answer.trim()&&seconds>0)}>{busy?'Saving answer...':seconds===0?'Save timed-out answer':'Check answer'}</button>
    </form>:<div aria-live="polite" className={`mt-4 rounded-xl p-4 ${round.response.correct?'bg-emerald-50 text-emerald-900':'bg-amber-50 text-amber-900'}`}><p className="font-semibold">{round.response.correct?'Well done! That is correct.':round.response.timedOut?'Time ended. Let us learn this one.':'Good effort! Here is the answer to remember.'}</p><p className="mt-2">Correct answer: {round.response.correctAnswer}</p><p className="my-2 text-sm">+{round.response.points} practice points</p><button disabled={busy} className={button} onClick={()=>void act('next')}>{busy?'Loading...':round.questionNumber===round.questionCount?'See my result':'Next question'}</button></div>}
   </>}
  </div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{library===null?<p className="text-sm">Loading practice quizzes...</p>:!library.length?<p className="text-sm text-slate-600">Your completed live quizzes will appear here after your teacher ends the session.</p>:library.map(q=>{const completed=q.attempts.filter(a=>a.finishedAt),latest=completed[0],pending=q.attempts.find(a=>!a.finishedAt);return <article key={q.id} className="rounded-2xl bg-[#fbf6ef] p-5"><h3 className="text-lg font-semibold">{q.title}</h3><p className="my-3 text-sm">{latest?`Latest: ${latest.correctCount}/${latest.questionCount} correct | Best: ${Math.max(...completed.map(a=>a.score))} points`:'Ready for your first practice run'}</p><button className={button} disabled={busy} onClick={()=>void act('start',{quizId:q.id})}><RotateCcw className="mr-2 inline" size={16}/>{busy?'Opening...':pending?'Continue practice':'Start practice'}</button>{completed.length>0&&<details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">View results ({completed.length})</summary><ul className="mt-2 space-y-2">{completed.map(a=><li key={a.id}><button disabled={busy} onClick={()=>void openResult(a.id)} className="text-left underline">{new Date(a.finishedAt!).toLocaleDateString()} | {a.correctCount}/{a.questionCount} correct | {a.score} points</button></li>)}</ul></details>}</article>;})}</div>}
 </section>;
}
