"use client";
import { useRef, useState } from "react";
import { BookOpen, HeartHandshake, Sparkles, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { MONTHLY_SECTIONS, MONTHLY_QUESTIONS, visibleQuestion, answerText, type Answers, type Question } from "@/lib/feedback/monthly-questions";
export type ChildFeedbackInfo = { id: string; name: string; age: string; country: string; timezone: string; programmes: string; qabila: string };
type Details = { parentName: string; childName: string; age: string; country: string; timezone: string };
type Draft = { details: Details; answers: Answers; step: number };
export type SavedFeedback = { studentId: string; month: string; submittedAt: string; answers: Answers };
const inputClass = "w-full rounded-xl border border-[#cbd8df] bg-white px-3 py-3 text-base text-[#22304a] focus:outline-none focus:ring-2 focus:ring-[#d79142]";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-full bg-[#22304a] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const icons = [BookOpen, Sparkles, HeartHandshake];
export function MonthlyParentForm({ learners, parentName, initialChild, month, initialMonth, saved }: { learners: ChildFeedbackInfo[]; parentName: string; initialChild: string; month: string; initialMonth: string; saved: SavedFeedback[] }) {
 const [childId, setChild] = useState(initialChild), [period, setPeriod] = useState(initialMonth);
 const [drafts, setDrafts] = useState<Record<string, Draft>>({}), [completed, setCompleted] = useState(saved);
 const [pending, setPending] = useState(false), [error, setError] = useState("");
 const busy = useRef(false), form = useRef<HTMLFormElement>(null), heading = useRef<HTMLHeadingElement>(null);
 const child = learners.find(c => c.id === childId) ?? learners[0];
 if (!child) return <p>No learners are linked to your account yet. Please contact the team.</p>;
 const key = child.id + ":" + period;
 const draft = drafts[key] ?? { details: { parentName, childName: child.name, age: child.age, country: child.country, timezone: child.timezone }, answers: {}, step: 0 };
 const response = completed.find(s => s.studentId === child.id && s.month === period);
 const update = (patch: Partial<Draft>) => setDrafts(old => ({ ...old, [key]: { ...draft, ...patch } }));
 const setAnswer = (id: string, value: string | string[]) => update({ answers: { ...draft.answers, [id]: value } });
 const section = MONTHLY_SECTIONS[draft.step], Icon = icons[draft.step];
 const changeStep = (next: number) => { update({ step: next }); setError(""); requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }); };
 async function submit() {
  if (busy.current) return;
  busy.current = true; setPending(true); setError("");
  try {
   const res = await fetch("/api/feedback/monthly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: child.id, month: period, details: draft.details, answers: draft.answers }) });
   const data = await res.json();
   if (!res.ok) { if (data.duplicate) { window.location.assign("/parent/feedback?child=" + encodeURIComponent(child.id) + "&month=" + period); return; } throw new Error(data.error || "Unable to save. Please try again."); }
   setCompleted(old => [...old, { studentId: child.id, month: period, submittedAt: new Date().toISOString(), answers: draft.answers }]);
  } catch (err) { setError(err instanceof Error ? err.message : "Connection interrupted. Your answers are still here; please try again."); }
  finally { busy.current = false; setPending(false); }
 }
 return <div className="space-y-5 text-[#22304a]">
  <section className="rounded-3xl border border-[#e5d6c5] bg-white p-5 sm:p-6">
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="grid gap-2 font-semibold">Choose your child<select className={inputClass} disabled={pending} value={child.id} onChange={e => { setChild(e.target.value); setError(""); }}>{learners.map(c => <option value={c.id} key={c.id}>{c.name}{completed.some(s => s.studentId === c.id && s.month === period) ? " - submitted" : ""}</option>)}</select></label>
    <label className="grid gap-2 font-semibold">Feedback month<input className={inputClass} type="month" min="2020-01" max={month} required value={period} disabled={pending} onChange={e => { if (e.target.value) { setPeriod(e.target.value); setError(""); } }} /></label>
   </div>
   <p className="mt-3 text-sm text-[#637184]">One response per child per month. Select another child to share their feedback. Your unfinished answers stay here while you switch learners in this page.</p>
   <p className="mt-2 text-sm">{child.programmes}{child.qabila ? " | " + child.qabila : ""}</p>
  </section>
  {response ? <section className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6" role="status"><CheckCircle2 className="h-9 w-9 text-emerald-700" /><h2 className="text-xl font-bold">JazakAllahu khairan! Feedback submitted.</h2><p>Your {period} feedback for {child.name} has been saved. The Gen-Mumin team can now review it.</p><p className="text-sm">Need to correct a submitted answer? Please contact the team.</p><details><summary className="cursor-pointer font-semibold">Review submitted answers</summary><dl className="mt-4 space-y-4">{MONTHLY_QUESTIONS.filter(q => visibleQuestion(q, response.answers) && answerText(response.answers[q.id])).map(q => <div key={q.id}><dt className="font-semibold">{q.label}</dt><dd className="whitespace-pre-wrap">{answerText(response.answers[q.id])}</dd></div>)}</dl></details></section> :
  <form ref={form} onSubmit={e => { e.preventDefault(); if (draft.step < 2) changeStep(draft.step + 1); else void submit(); }} className="rounded-3xl border border-[#e5d6c5] bg-white p-5 sm:p-7">
   <fieldset disabled={pending} className="min-w-0 space-y-6">
    <legend className="sr-only">Monthly feedback for {child.name}</legend>
    <ol className="grid grid-cols-3 gap-2" aria-label="Feedback progress">{MONTHLY_SECTIONS.map((s, i) => { const StepIcon = icons[i]; return <li key={s.title} aria-current={i === draft.step ? "step" : undefined} className={`rounded-2xl p-3 text-center text-xs sm:text-sm ${i === draft.step ? "bg-[#22304a] text-white" : i < draft.step ? "bg-emerald-50 text-emerald-800" : "bg-[#f7f2ea]"}`}><StepIcon className="mx-auto mb-2 h-5 w-5" aria-hidden="true" /><span>{i + 1}. {s.title}</span></li>; })}</ol>
    {draft.step === 0 && <details open className="rounded-2xl bg-[#f7f2ea] p-4"><summary className="cursor-pointer font-semibold">Check your family details</summary><p className="my-3 text-sm">These are filled from your account. Changes here apply to this feedback only.</p><div className="grid gap-4 sm:grid-cols-2">{([['parentName','Parent name'],['childName','Child name'],['age','Child age'],['country','Country'],['timezone','Time zone']] as const).map(([id,label]) => <label key={id} className="grid gap-1 text-sm font-medium">{label}<input className={inputClass} type={id === 'age' ? 'number' : 'text'} min={id === 'age' ? 1 : undefined} max={id === 'age' ? 99 : undefined} maxLength={150} required={id === 'parentName' || id === 'childName'} value={draft.details[id]} onChange={e => update({ details: { ...draft.details, [id]: e.target.value } })} /></label>)}</div></details>}
    <div><h2 ref={heading} tabIndex={-1} className="flex items-center gap-3 text-xl font-bold outline-none"><Icon className="h-6 w-6 text-amber-600" aria-hidden="true" />{section.title}</h2><p className="mt-2 text-sm text-[#637184]">{section.description} Questions marked * are required; everything else is optional.</p></div>
    <div className="grid gap-5 md:grid-cols-2">{section.questions.filter(q => visibleQuestion(q, draft.answers)).map(q => <QuestionField key={q.id} question={q} value={draft.answers[q.id]} onChange={value => setAnswer(q.id, value)} />)}</div>
    {draft.step === 2 && <details className="rounded-2xl bg-[#f7f2ea] p-4"><summary className="cursor-pointer font-semibold">Review all answers before submitting</summary><p className="mt-3">{draft.details.childName} | {draft.details.parentName} | {period}</p><dl className="mt-4 space-y-3">{MONTHLY_QUESTIONS.filter(q => visibleQuestion(q, draft.answers) && answerText(draft.answers[q.id])).map(q => <div key={q.id}><dt className="font-semibold">{q.label}</dt><dd className="whitespace-pre-wrap text-sm">{answerText(draft.answers[q.id])}</dd></div>)}</dl></details>}
    <p className="text-xs text-[#637184]">Your feedback is shared with Gen-Mumin administrators, Sir Mehran and Sister Saba to support your family.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><button type="button" className="inline-flex items-center gap-2 rounded-full border px-5 py-3 disabled:opacity-40" disabled={draft.step === 0 || pending} onClick={() => changeStep(draft.step - 1)}><ArrowLeft className="h-4 w-4" />Back</button><span className="text-sm">Step {draft.step + 1} of 3</span><button type="submit" disabled={pending} className={buttonClass}>{pending ? "Submitting..." : draft.step === 2 ? "Submit monthly feedback" : "Continue"}<ArrowRight className="h-4 w-4" /></button></div>
   </fieldset>
  </form>}
 </div>;
}
function QuestionField({ question: q, value, onChange }: { question: Question; value?: string | string[]; onChange: (value: string | string[]) => void }) {
 const id = "feedback-" + q.id;
 return <fieldset className={`min-w-0 rounded-2xl border border-[#e5e9ed] p-4 ${q.kind === "text" || q.kind === "multi" ? "md:col-span-2" : ""}`}><legend className="px-1 text-sm font-semibold">{q.label}{q.required ? " *" : ""}</legend>
  {q.kind === "text" ? <textarea id={id} aria-label={q.label} className={inputClass} rows={3} maxLength={2500} required={q.required} value={typeof value === "string" ? value : ""} onChange={e => onChange(e.target.value)} /> : q.kind === "number" ? <input aria-label={q.label} className={inputClass} type="number" min={0} max={10000} step={1} value={typeof value === "string" ? value : ""} onChange={e => onChange(e.target.value)} /> : <div className={`grid gap-2 ${q.kind === "multi" ? "sm:grid-cols-2" : ""}`}>{q.options?.map(option => {
   const checked = q.kind === "multi" ? Array.isArray(value) && value.includes(option) : value === option;
   return <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${checked ? "border-amber-400 bg-amber-50" : "border-[#e5e9ed] bg-white"}`}><input type={q.kind === "multi" ? "checkbox" : "radio"} name={id} required={q.required && q.kind === "choice"} value={option} checked={checked} onChange={() => { if (q.kind !== "multi") onChange(option); else { const old = Array.isArray(value) ? value : []; const exclusive = ["No difficulties", "No challenges", "Not applicable"]; onChange(checked ? old.filter(v => v !== option) : exclusive.includes(option) ? [option] : [...old.filter(v => !exclusive.includes(v)), option]); } }} className="h-4 w-4 shrink-0 accent-[#c47c28]" />{option}</label>;
  })}</div>}
 </fieldset>;
}
