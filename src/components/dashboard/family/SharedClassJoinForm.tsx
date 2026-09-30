"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function SharedClassJoinForm({ scheduleId, students, live }: { scheduleId: string; students: Array<{ id: string; name: string }>; live: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [live, router]);
  return <form action={"/api/live-classes/" + encodeURIComponent(scheduleId) + "/join"} method="post" onSubmit={() => setSubmitting(true)} className="space-y-5">
    <fieldset className="space-y-3"><legend className="mb-3 font-semibold">Who is joining this class?</legend>
      {students.map(student => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#eadfce] p-4"><input type="radio" name="student" value={student.id} required defaultChecked={students.length === 1} /><span>{student.name}</span></label>)}
    </fieldset>
    <p className="text-sm text-[#617184]">Choose the child who is attending. Joining through this button records their portal attendance, then opens Zoom.</p>
    <button disabled={!live || submitting} className="w-full rounded-full bg-[#22304a] px-6 py-4 font-semibold text-white disabled:opacity-60">{submitting ? "Recording attendance and opening Zoom..." : live ? "Join class" : "Waiting for the teacher to start"}</button>
    {!live && <button type="button" onClick={() => router.refresh()} className="text-sm underline">Check again</button>}
  </form>;
}
