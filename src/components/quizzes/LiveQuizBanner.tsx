'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { QuizLobby } from '@/lib/quizzes/protocol';
export const quizVisitKey = (session: string, student: string) => `quiz-joined:${session}:${student}`;
export function LiveQuizBanner({ role }: { role: 'parent' | 'student' }) {
 const path = usePathname();
 const [lobbies, setLobbies] = useState<QuizLobby[]>([]);
 useEffect(() => {
  if (path.includes('/quizzes/live/')) return;
  let stopped = false, timer: ReturnType<typeof setTimeout>, controller: AbortController | undefined, busy = false, failures = 0;
  async function poll() {
   clearTimeout(timer);
   if (stopped || busy) return;
   if (document.hidden || !navigator.onLine) { timer = setTimeout(poll, 3000); return; }
   busy = true; controller = new AbortController(); const timeout = setTimeout(() => controller?.abort(), 10000);
   try {
    const response = await fetch('/api/quizzes/live/active', { cache: 'no-store', signal: controller.signal });
    if (response.status === 401 || response.status === 403) { stopped = true; setLobbies([]); return; }
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!stopped) setLobbies(data.quizzes ?? []);
    failures = 0;
   } catch { failures++; } finally { clearTimeout(timeout); busy = false; if (!stopped) timer = setTimeout(poll, Math.min(15000, 3000 * (failures + 1)) + Math.random()*500); }
  }
  const wake = () => { if (!document.hidden) void poll(); };
  void poll(); document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
 }, [path]);
 if (path.includes('/quizzes/live/')) return null;
 const visible = lobbies.filter(lobby => { try { return path === `/${role}` || !sessionStorage.getItem(quizVisitKey(lobby.sessionId, lobby.studentId)); } catch { return true; } });
 if (!visible.length) return null;
 return <aside aria-label="Live quiz invitation" className="sticky top-0 z-50 border-b border-amber-300 bg-[#193654] px-4 py-3 text-white shadow-lg"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3"><span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-slate-900">LIVE QUIZ</span>{visible.map(lobby => <Link prefetch={false} key={`${lobby.sessionId}:${lobby.studentId}`} href={`/${role}/quizzes/live/${lobby.sessionId}?child=${lobby.studentId}`} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">{lobby.childName}: {lobby.title} &mdash; Join quiz &rarr;</Link>)}</div></aside>;
}
export function StartLiveQuizButton({ quizId, published }: { quizId: string; published: boolean }) {
 const [pending, setPending] = useState(false), [error, setError] = useState(''); const lock = useRef(false);
 async function start() {
  if (lock.current) return; lock.current = true; setPending(true); setError('');
  try {
   const response = await fetch('/api/quizzes/live/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId }), signal: AbortSignal.timeout(30000) });
   const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to open lobby. Please retry.');
   window.location.assign(`/teacher/quizzes/live/${data.sessionId}`);
  } catch (error) { setError(error instanceof Error ? error.message : 'Please retry.'); lock.current = false; setPending(false); }
 }
 return <div><button disabled={pending || !published} onClick={start} className="rounded-full bg-[#2f6b4b] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? 'Opening lobby...' : published ? 'Start live' : 'Publish to start live'}</button>{error && <p role="alert" className="max-w-sm text-sm text-red-700">{error}</p>}</div>;
}
