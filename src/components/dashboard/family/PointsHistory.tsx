"use client";

import { pointActivityReason, pointActivityCategory } from "@/lib/community/point-display";
import { useState } from "react";

type Entry = { id: string; points: number; reason: string; sourceType: string; awardedAt: Date | string };
const PAGE_SIZE = 10;

export function PointsHistory({ entries }: { entries: Entry[] }) {
  const [quizOnly, setQuizOnly] = useState(false);
  const [page, setPage] = useState(0);
  const filtered = quizOnly ? entries.filter((entry) => entry.sourceType.includes("QUIZ")) : entries;
  const total = entries.reduce((sum, entry) => sum + entry.points, 0);
  const quizTotal = entries.filter((entry) => entry.sourceType.includes("QUIZ")).reduce((sum, entry) => sum + entry.points, 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  return <section id="points-history" aria-labelledby="points-history-title" tabIndex={-1} className="scroll-mt-28 rounded-[26px] border border-[#eadfce] bg-white p-5">
    <h2 id="points-history-title" className="text-xl font-semibold text-[#22304a]">My points history</h2>
    <p className="mt-2 text-sm text-[#617184]">{total} total points, including {quizTotal} quiz points. Each entry shows the points awarded or adjusted for this learner. Quiz game scores can differ from awarded House points.</p>
    <div className="my-4 flex gap-2">{[false, true].map((quizzes) => <button key={String(quizzes)} type="button" aria-pressed={quizOnly === quizzes} onClick={() => { setQuizOnly(quizzes); setPage(0); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${quizOnly === quizzes ? "bg-[#22304a] text-white" : "bg-[#fbf6ef] text-[#22304a]"}`}>{quizzes ? "Quiz points" : "All points"}</button>)}</div>
    {filtered.length ? <>
      <ul className="space-y-2">{filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((entry) => <li key={entry.id} className="flex items-start justify-between gap-4 rounded-2xl bg-[#fbf6ef] p-4">
        <div><p className="font-semibold text-[#22304a]">{pointActivityReason(entry.sourceType, entry.reason)}</p><p className="mt-1 text-xs text-[#617184]">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(entry.awardedAt))} PKT · {pointActivityCategory(entry.sourceType)}</p></div>
        <span className={`shrink-0 font-semibold ${entry.points < 0 ? "text-[#a23c3c]" : "text-[#237044]"}`}>{entry.points > 0 ? "+" : ""}{entry.points} pts</span>
      </li>)}</ul>
      {pageCount > 1 ? <div className="mt-4 flex items-center justify-between gap-3 text-sm"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div> : null}
    </> : <p className="text-sm text-[#617184]">{quizOnly ? "No quiz point awards are recorded yet. Quiz participation without an award does not appear in this list." : "No point awards are recorded yet."}</p>}
  </section>;
}
