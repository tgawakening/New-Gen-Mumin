"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";

type Student = { id: string; name: string };
type Badge = { key: string; title: string; description: string };

export function AwardBadgeForm({ action, students, badges, bonuses, initialBadge }: {
  action: (data: FormData) => Promise<void>;
  students: Student[];
  badges: Badge[];
  bonuses: Record<string, number>;
  initialBadge: string;
}) {
  const [badgeKey, setBadgeKey] = useState(initialBadge);
  const [studentId, setStudentId] = useState("");
  const badge = badges.find(item => item.key === badgeKey);
  const crossQabila = badgeKey === "HOUSE_BUILDER" || badgeKey === "ALLIANCE_CHAMPION";
  const field = "w-full rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 font-normal";

  if (!students.length) return <p className="rounded-2xl bg-[#fff8e8] p-4 text-sm text-[#617184]">No students are assigned to your roster yet. Ask admin to check your class roster before awarding a badge.</p>;

  return <form id="award-badge" action={action} className="grid scroll-mt-8 gap-4 lg:grid-cols-2">
    <label className="grid gap-2 text-sm font-bold text-[#22304a]">1. Choose student
      <select name="studentId" required value={studentId} onChange={event => setStudentId(event.target.value)} className={field}><option value="">Choose roster student</option>{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select>
    </label>
    <label className="grid gap-2 text-sm font-bold text-[#22304a]">2. Choose badge
      <select name="badgeKey" required value={badgeKey} onChange={event => setBadgeKey(event.target.value)} className={field}><option value="">Choose a character badge</option>{badges.map(item => <option key={item.key} value={item.key}>{item.title} · {bonuses[item.key] ?? 10} House points</option>)}</select>
    </label>
    {badge ? <p aria-live="polite" className="rounded-2xl bg-[#fff8e8] p-4 text-sm leading-6 text-[#617184] lg:col-span-2"><strong className="text-[#22304a]">{badge.title}: </strong>{badge.description}</p> : null}
    <label className="grid gap-2 text-sm font-bold text-[#22304a] lg:col-span-2">3. What did the student do?
      <textarea name="evidence" required minLength={12} maxLength={500} rows={3} placeholder="Example: Helped a classmate practise patiently and encouraged them to try again." className={field} />
      <span className="text-xs font-normal text-[#617184]">Write a specific reason (12–500 characters). It will appear with the student&apos;s award.</span>
    </label>
    {crossQabila ? <label className="grid gap-2 text-sm font-bold text-[#22304a] lg:col-span-2">Learner helped in another Qabila
      <select key={studentId} name="beneficiaryStudentId" required className={field}><option value="">Choose the learner who benefited</option>{students.filter(student => student.id !== studentId).map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select>
      <span className="text-xs font-normal text-[#617184]">Choose a learner from a different Qabila in your roster.</span>
    </label> : null}
    <FormSubmitButton pendingLabel="Awarding badge…" className="min-h-11 w-fit rounded-full bg-[#22304a] px-6 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">Award badge</FormSubmitButton>
  </form>;
}
