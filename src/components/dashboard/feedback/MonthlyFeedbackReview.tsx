"use client";
import { useState } from "react";
import { MONTHLY_SECTIONS, MONTHLY_QUESTIONS, answerText, type Answers } from "@/lib/feedback/monthly-questions";
export type ReviewResponse = { id: string; month: string; submittedAt: string; parentEmail: string; details: Record<string, string>; answers: Answers };
export function MonthlyFeedbackReview({ responses }: { responses: ReviewResponse[] }) {
 const [tab, setTab] = useState("questions"), [search, setSearch] = useState("");
 const rows = responses.filter(r => [r.details.parentName, r.details.childName, r.details.programmes, r.details.qabila].join(" ").toLowerCase().includes(search.toLowerCase()));
 return <div className="space-y-5">
  <div className="grid gap-3 sm:grid-cols-3">{[["Responses", rows.length], ["Requesting contact", rows.filter(r => r.answers.contactRequest === "Yes").length], ["Feeling disconnected", rows.filter(r => r.answers.belonging === "Disconnected or left out").length]].map(([label,n]) => <div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold">{n}</p></div>)}</div>
  <label className="grid gap-2 text-sm font-semibold">Find a family, programme or Qabila<input type="search" value={search} onChange={e => setSearch(e.target.value)} className="rounded-xl border bg-white p-3 text-base" /></label>
  <div className="flex gap-3">{[["questions", "By question"], ["families", "Individual responses"]].map(([value,label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-full px-5 py-3 font-semibold ${tab === value ? "bg-[#22304a] text-white" : "border bg-white"}`}>{label}</button>)}</div>
  {!rows.length && <p className="rounded-2xl bg-white p-6">No responses match this month or search yet.</p>}
  {rows.length > 0 && tab === "questions" && MONTHLY_SECTIONS.map(section => <section key={section.title} className="space-y-3"><h2 className="text-xl font-bold">{section.title}</h2>{section.questions.map(q => {
   const answered = rows.filter(r => answerText(r.answers[q.id]));
   return <details key={q.id} className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-semibold">{q.label}<span className="ml-2 text-xs font-normal text-slate-500">{answered.length} of {rows.length} answered</span></summary>
    {q.options && answered.length > 0 && <div className="my-4 grid gap-2 sm:grid-cols-2">{q.options.map(option => { const count = answered.filter(r => Array.isArray(r.answers[q.id]) ? r.answers[q.id].includes(option) : r.answers[q.id] === option).length; return <div key={option} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-2"><span>{option}</span><strong>{count} ({Math.round(count / answered.length * 100)}%)</strong></div><progress className="mt-2 h-2 w-full accent-amber-500" value={count} max={answered.length} aria-label={option} /></div>; })}</div>}
    {q.kind === "multi" && <p className="text-xs text-slate-500">Multiple selections allowed. Percentages are of families who answered this question.</p>}
    <ul className="mt-4 divide-y">{answered.map(r => <li key={r.id} className="py-3"><p className="text-sm font-semibold">{r.details.childName} <span className="font-normal text-slate-500">({r.details.parentName})</span></p><p className="whitespace-pre-wrap break-words text-sm">{answerText(r.answers[q.id])}</p></li>)}</ul>{!answered.length && <p className="mt-3 text-sm">No answers to this question.</p>}
   </details>;
  })}</section>)}
  {tab === "families" && rows.map(r => <details key={r.id} className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-semibold">{r.details.childName} - {r.details.parentName}<span className="ml-3 text-xs font-normal">{new Date(r.submittedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span></summary><div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">{Object.entries(r.details).map(([key,value]) => <p key={key}><strong>{key.replace(/([A-Z])/g, " $1")}: </strong>{value || "Not provided"}</p>)}<p><strong>Parent email: </strong>{r.parentEmail}</p></div><dl className="mt-4 space-y-4">{MONTHLY_QUESTIONS.filter(q => answerText(r.answers[q.id])).map(q => <div key={q.id}><dt className="font-semibold">{q.label}</dt><dd className="whitespace-pre-wrap break-words text-sm">{answerText(r.answers[q.id])}</dd></div>)}</dl></details>)}
 </div>;
}
