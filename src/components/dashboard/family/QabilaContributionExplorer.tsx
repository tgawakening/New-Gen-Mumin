"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ListFilter, RefreshCw, X } from "lucide-react";
import type { ContributionEvent, QabilaHistory } from "@/lib/community/qabila-history";

const pointsText = (points: number) => `${points > 0 ? "+" : ""}${points}`;
function Score({ event }: { event: ContributionEvent }) {
  return <>{event.score ? <span className="mt-1 block text-xs font-semibold text-[#24466e]">{event.score.correct}/{event.score.total} correct{event.score.historicalTotal ? <span className="block font-normal text-[#788596]">Older result · total based on current quiz</span> : null}</span> : null}
    {event.quizEarnedPoints !== null && event.quizEarnedPoints !== event.points ? <span className="mt-1 block text-xs text-[#8a6326]">Quiz score: {event.quizEarnedPoints} points · recorded Qabila credit: {event.points}</span> : null}</>;
}

export function QabilaContributionExplorer({ qabila, highlighted, preview }: { qabila: string; highlighted: boolean; preview: ContributionEvent[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const asOf = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [studentId, setStudentId] = useState("");
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<QabilaHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    async function load() {
      setLoading(true); setError("");
      const query = new URLSearchParams({ qabila, page: String(page) });
      if (studentId) query.set("studentId", studentId);
      if (asOf.current) query.set("asOf", asOf.current);
      try {
        const response = await fetch(`/api/community/qabila-contributions?${query}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load contributions.");
        if (!controller.signal.aborted) { asOf.current = result.asOf; setData(result); }
      } catch (caught) { if (!disposed) setError(controller.signal.aborted ? "Loading took too long. Please try again." : caught instanceof Error ? caught.message : "Could not load contributions."); }
      finally { window.clearTimeout(timeout); if (!disposed) setLoading(false); }
    }
    void load();
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [open, qabila, page, studentId, reload]);

  function showHistory() {
    asOf.current = null; setPage(1); setStudentId(""); setData(null); setError("");
    dialog.current?.showModal(); setOpen(true);
  }
  function refresh() { asOf.current = null; setPage(1); setReload(value => value + 1); }

  return <div className="rounded-[18px] border border-[#e3e9ef] bg-white/90 p-3">
    <p className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-[#a46626]">Recent contributions</p>
    <div className="space-y-3">{preview.map(event => <div key={event.id} className="flex items-start justify-between gap-3 text-xs">
      <div className="min-w-0"><p className="truncate font-bold text-[#2c405b]">{event.name}</p><p className="line-clamp-2 text-[#788596]">{event.label}</p><Score event={event} /></div><span className="shrink-0 font-bold tabular-nums text-[#2d7650]">{pointsText(event.points)}</span>
    </div>)}{!preview.length ? <p className="text-xs text-[#788596]">No contributions recorded yet.</p> : null}</div>
    <button type="button" onClick={showHistory} className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${highlighted ? "border border-[#c79134] bg-[#fff0c7] text-[#69440c] shadow-sm hover:bg-[#ffe5a0]" : "border border-[#d8e3ed] bg-[#f5f8fc] text-[#24466e] hover:bg-[#e9f1fa]"}`}><ListFilter className="h-4 w-4" />{highlighted ? "Your Qabila · View all contributions" : "View all contributions"}</button>

    <dialog ref={dialog} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} aria-label={`${qabila} contribution history`} className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-4xl overflow-y-auto rounded-3xl border border-[#d7e1eb] bg-[#f7f9fc] p-0 text-[#22304a] shadow-2xl backdrop:bg-[#10233b]/65">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#dce4ed] bg-white p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-widest text-[#a46626]">Contribution history</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">{qabila}</h2><p className="mt-2 text-sm text-[#617184]">Verified activity and recorded points for every member.</p></div><form method="dialog"><button aria-label="Close contributions" className="flex h-11 w-11 items-center justify-center rounded-full border bg-white hover:bg-slate-100"><X className="h-5 w-5" /></button></form></header>
      <div className="space-y-5 p-4 sm:p-6">
        {data ? <>
          <div className="grid grid-cols-3 gap-3">{[["Qabila points", data.totalPoints], ["Members", data.members.length], ["Activities shown", data.totalEvents]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-3"><p className="text-xs text-[#617184]">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>)}</div>
          <details className="rounded-2xl border border-[#dce4ed] bg-white p-4"><summary className="min-h-8 cursor-pointer font-bold">All members and total contributions</summary><p className="mt-2 text-xs leading-5 text-[#617184]">Totals include all recorded credits and adjustments. No recorded points does not necessarily mean no effort.</p><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{data.members.map(member => <button key={member.id} onClick={() => { setStudentId(member.id); setPage(1); }} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm ${studentId === member.id ? "border-[#c79134] bg-[#fff7df]" : "border-[#e4e9ef] bg-[#f8fafc] hover:border-[#c79134]"}`}><span>{member.name}</span><strong className="shrink-0 tabular-nums">{member.points} pts</strong></button>)}</div></details>
        </> : null}
        <div className="flex flex-wrap items-end justify-between gap-3"><label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">Learner<select value={studentId} onChange={event => { setStudentId(event.target.value); setPage(1); }} className="min-h-11 w-full min-w-0 rounded-xl border border-[#d8e3ed] bg-white px-3 py-2"><option value="">All Qabila members</option>{data?.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><button type="button" disabled={loading} onClick={refresh} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh</button></div>
        {loading ? <p role="status" className="text-sm text-[#617184]">Loading contribution history…</p> : null}
        {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button onClick={refresh} className="ml-3 font-bold underline">Try again</button></div> : null}
        {data && !error ? <div className={loading ? "opacity-50" : ""} aria-busy={loading}>
          <div className="space-y-3">{data.events.map(event => <article key={event.id} className="flex items-start justify-between gap-4 rounded-2xl border border-[#dce4ed] bg-white p-4"><div className="min-w-0"><h3 className="font-bold">{event.name}</h3><p className="mt-1 break-words text-sm text-[#617184]">{event.label}</p><Score event={event} /><time dateTime={event.occurredAt} className="mt-2 block text-xs text-[#788596]">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(event.occurredAt))} PKT</time></div><strong className={`shrink-0 text-lg tabular-nums ${event.points < 0 ? "text-[#a54b36]" : "text-[#2d7650]"}`}>{pointsText(event.points)}<span className="block text-right text-xs font-normal text-[#617184]">points</span></strong></article>)}{!data.events.length ? <p className="rounded-2xl border bg-white p-5 text-sm text-[#617184]">No recorded activity for this selection yet.</p> : null}</div>
          <nav aria-label="Contribution history pages" className="mt-5 flex items-center justify-between gap-2"><button disabled={loading || data.page <= 1} onClick={() => setPage(data.page - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Previous</button><span className="text-center text-xs text-[#617184]">Page {data.page} of {data.totalPages}<br />{data.totalEvents} activities</span><button disabled={loading || data.page >= data.totalPages} onClick={() => setPage(data.page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Next<ChevronRight className="h-4 w-4" /></button></nav>
        </div> : null}
        <p className="text-xs leading-5 text-[#788596]">Attendance, tracker submissions, homework and quiz credits come from the points ledger. Quiz bonuses appear separately. History stays at the same snapshot while paging; refresh to see newer activity.</p>
      </div>
    </dialog>
  </div>;
}
