'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LiveQuizState, QuizAnswerView } from '@/lib/quizzes/protocol';
import { QUIZ_AVATARS, quizAvatar } from '@/lib/quizzes/avatars';
import { quizVisitKey } from './LiveQuizBanner';
const button = 'rounded-xl bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50';
export function LiveQuizRoom({ sessionId, role, child }: { sessionId: string; role: 'teacher' | 'parent' | 'student'; child?: string }) {
 const teacher = role === 'teacher';
 const [state, setState] = useState<LiveQuizState | null>(null), [error, setError] = useState(''), [connectionError, setConnectionError] = useState(''), [pending, setPending] = useState(''), [draft, setDraft] = useState(''), [tick, setTick] = useState(0), [joined, setJoined] = useState(teacher);
 const latest = useRef<LiveQuizState | null>(null), mutation = useRef(false), generation = useRef(0), mounted = useRef(true), autoJoined = useRef(false), clock = useRef({ at: 0, server: 0 }), refresh = useRef<() => void>(() => {});
 const endpoint = `/api/quizzes/live/${encodeURIComponent(sessionId)}`;
 const accept = useCallback((next: LiveQuizState) => {
  const previous = latest.current;
  if (next.question === undefined) next.question = previous?.questionId === next.questionId ? previous.question : null;
  if (previous?.questionId !== next.questionId || previous?.round !== next.round) setDraft('');
  clock.current = { at: Date.now(), server: Date.parse(next.serverNow) };
  latest.current = next; setState(next);
 }, []);
 useEffect(() => {
  mounted.current = true; let stopped = false, busy = false, failures = 0, timer: ReturnType<typeof setTimeout>, controller: AbortController | undefined;
  async function poll() {
   clearTimeout(timer); if (stopped || busy) return;
   if (mutation.current || document.hidden || !navigator.onLine) { timer = setTimeout(poll, 2000); return; }
   busy = true; const version = generation.current; controller = new AbortController(); const timeout = setTimeout(() => controller?.abort(), 12000);
   try {
    const params = new URLSearchParams(); if (child) params.set('child', child); if (latest.current?.question?.id) params.set('known', latest.current.question.id);
    const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store', signal: controller.signal }); const data = await response.json();
    if (!response.ok) { if ([401,403,404].includes(response.status)) stopped = true; throw new Error(data.error || 'Unable to load this quiz.'); }
    if (!stopped && generation.current === version) { accept(data); setConnectionError(''); }
    failures = 0;
   } catch (error) { failures++; if (!stopped || failures === 1) setConnectionError(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Reconnecting... Your saved answers are safe.'); }
   finally { clearTimeout(timeout); busy = false; if (!stopped && latest.current?.status !== 'ENDED') timer = setTimeout(poll, Math.min(10000, 2000 * (failures + 1)) + Math.random()*250); }
  }
  refresh.current = () => { void poll(); }; const wake = () => { if (!document.hidden) void poll(); };
  void poll(); document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
  return () => { stopped = true; mounted.current = false; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
 }, [accept, child, endpoint]);
 const send = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
  if (mutation.current) return; mutation.current = true; generation.current++; setPending(action); setError('');
  try {
   const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, studentId: child || latest.current?.learner?.id, round: latest.current?.round, ...extra }), signal: AbortSignal.timeout(20000) });
   const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to save. Please retry.');
   if (!mounted.current) return;
   if (action === 'join') { setJoined(true); try { sessionStorage.setItem(quizVisitKey(sessionId, data.studentId), '1'); } catch {} }
   if (data.response && latest.current) {
    const saved = data.response as QuizAnswerView;
    const next = { ...latest.current, response: saved, responses: [...latest.current.responses.filter(r => r.questionId !== saved.questionId), saved] }; latest.current = next; setState(next);
   }
   if (data.nextSessionId) window.location.assign(`/teacher/quizzes/live/${data.nextSessionId}`);
  } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'Please retry.'); }
  finally { mutation.current = false; if (mounted.current) { setPending(''); refresh.current(); } }
 }, [child, endpoint, sessionId]);
 useEffect(() => { if (teacher || !state?.learner || autoJoined.current || state.status === 'ENDED') return; autoJoined.current = true; void send('join'); }, [teacher, state?.learner, state?.status, send]);
 useEffect(() => { if (!teacher || state?.status === 'ENDED') return; let busy = false;
  const beat = async () => { if (busy || mutation.current) return; busy = true; try { await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat' }), signal: AbortSignal.timeout(12000) }); } catch {} finally { busy = false; } };
  void beat(); const timer = setInterval(beat, 15000); return () => clearInterval(timer);
 }, [teacher, endpoint, state?.status]);
 useEffect(() => { const timer = setInterval(() => setTick(t => t + 1), 500); return () => clearInterval(timer); }, []);
 void tick;
 const remaining = state?.deadline ? Math.max(0, Math.ceil((Date.parse(state.deadline) - clock.current.server - (Date.now() - clock.current.at)) / 1000)) : 0;
 const question = state?.question;
 return <main className="min-h-screen bg-[#f7f2ea] px-4 py-6 text-[#22304a]"><div className="mx-auto max-w-5xl space-y-5"><Link href={`/${role}/quizzes`} className="text-sm underline">Back to quizzes</Link><header className="rounded-3xl bg-[#193654] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-amber-300">Gen-Mumin live quiz</p><h1 className="mt-2 text-2xl font-bold">{state?.title || 'Connecting to your quiz...'}</h1><p className="mt-2 text-sm">{teacher ? `${state?.roster?.filter(s => s.joined).length ?? 0} learners joined / ${state?.roster?.length ?? 0} invited` : state?.learner?.name}</p></header>
 {(error || connectionError) && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">{error || connectionError} <button onClick={() => refresh.current()} className="ml-2 underline">Retry connection</button></div>}
 {state?.status === 'ENDED' ? <section className="rounded-3xl bg-white p-6"><h2 className="text-2xl font-bold">Quiz finished</h2>{!teacher && <><p className="mt-3">{state.responses.length} answers saved. {state.responses.filter(r => r.correct).length} correct. {state.responses.reduce((sum,r) => sum+r.points,0) + state.bonus} points earned.</p>{state.questions?.map(q => <div key={q.id} className="mt-3 border-t py-3"><strong>{q.prompt}</strong><p>{state.responses.find(r => r.questionId === q.id)?.answer || 'No answer submitted'}</p></div>)}</>}{teacher && <button className={`${button} mt-4`} disabled={!!pending} onClick={() => void send('restart')}>Start a new attempt</button>}</section> : <>
 {!teacher && state && !joined && <section className="rounded-3xl bg-white p-6"><h2 className="font-bold">Ready to play, {state.learner?.name}?</h2><p className="my-2 text-sm">Join now so your teacher knows you are ready. Questions will appear here automatically.</p><button className={button} disabled={!!pending} onClick={() => void send('join')}>{pending === 'join' ? 'Joining...' : 'Join quiz'}</button><details className="mt-4"><summary className="cursor-pointer text-sm">Choose your animal avatar</summary><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{QUIZ_AVATARS.map(a => <button key={a.id} disabled={!!pending} onClick={() => void send('join', { avatarId: a.id })} className="rounded-xl border p-3 text-sm"><span className="block text-3xl">{a.emoji}</span>{a.name}</button>)}</div></details></section>}
 {state && (joined || teacher) && <section className="rounded-3xl bg-white p-6 shadow-sm">{!question ? <><h2 className="text-xl font-bold">{teacher ? 'Your lobby is open' : 'You are in! Waiting for your teacher.'}</h2><p className="mt-2 text-sm">{teacher ? 'Invited learners can join from their live quiz banner. Wait for them to join before opening the first question.' : 'Keep this page open. The next question will appear automatically.'}</p></> : <><div className="flex items-center justify-between gap-3"><span className="text-sm">Question {state.questionNumber} of {state.questionCount}</span><span role="timer" className="rounded-full bg-amber-100 px-4 py-2 font-bold">{remaining > 0 ? `${remaining}s` : 'Time ended'}</span></div><h2 className="my-5 whitespace-pre-wrap text-xl font-bold">{question.prompt}</h2>{question.image && <img src={question.image} alt="Question illustration" className="mb-5 max-h-72 max-w-full rounded-xl object-contain" />}
 {!teacher && (state.response ? <p role="status" className="rounded-xl bg-green-50 p-4 font-semibold text-green-800">Answer saved: {state.response.answer}. Wait for the next question.</p> : <form onSubmit={event => { event.preventDefault(); void send('answer', { questionId: state.questionId, round: state.round, answer: draft }); }}><fieldset disabled={!!pending || remaining === 0} className="space-y-3">{question.choices.length ? question.choices.map(choice => <label key={choice} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 ${draft === choice ? 'border-amber-400 bg-amber-50' : 'border-slate-100'}`}><input type="radio" name="answer" value={choice} checked={draft === choice} onChange={() => setDraft(choice)} />{choice}</label>) : <textarea aria-label="Your answer" value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} className="w-full rounded-xl border p-4" />}<button disabled={!draft.trim() || !!pending || remaining === 0} className={button}>{pending === 'answer' ? 'Saving answer...' : 'Submit answer'}</button></fieldset>{remaining === 0 && <p className="mt-3 text-sm">Wait for the next question. Your teacher can reopen this round if needed.</p>}</form>)}
 {teacher && <div className="flex flex-wrap items-center gap-3"><p className="font-semibold">{state.roster?.filter(s => s.answer).length ?? 0} answers received</p><button className={button} disabled={!!pending} onClick={() => void send('reopen', { questionId: state.questionId })}>Reopen timer</button></div>}</>}
 {teacher && <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">{state.questions?.map((q,i) => <button className={button} key={q.id} disabled={!!pending || state.questionId === q.id} onClick={() => void send('open', { questionId: q.id })}>{pending && pending !== 'heartbeat' ? 'Please wait...' : `Open question ${i+1}`}</button>)}<button className="rounded-xl border border-red-300 px-4 py-3 text-sm text-red-700 disabled:opacity-50" disabled={!!pending} onClick={() => { if (window.confirm('Finish this quiz and save the final results?')) void send('end'); }}>Finish quiz</button></div>}</section>}
 </>}
 {teacher && state && <section className="rounded-3xl bg-white p-6"><h2 className="text-xl font-bold">Live participation</h2><div className="my-4 flex flex-wrap gap-3">{state.teams?.map(team => <span key={team.name} className="rounded-xl bg-amber-50 px-4 py-2 font-semibold">{team.name}: {team.points} points</span>)}</div><div className="grid gap-3 sm:grid-cols-2">{state.roster?.map(learner => <div key={learner.id} className="rounded-xl border border-slate-200 p-3"><span className="mr-2 text-2xl">{quizAvatar(learner.avatar).emoji}</span><strong>{learner.name}</strong><p className="mt-1 text-xs">{learner.house} &middot; {learner.joined ? 'Joined' : 'Not joined yet'}</p><p className="mt-2 text-sm">{learner.answer ? `${learner.answer.answer} - ${learner.answer.correct === null ? 'For review' : learner.answer.correct ? 'Correct' : 'Incorrect'} (${learner.answer.seconds}s)` : 'Waiting for an answer'}</p></div>)}</div></section>}
 </div></main>;
}
