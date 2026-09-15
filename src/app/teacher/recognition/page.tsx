import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Award, CalendarDays, FileText, Sparkles } from "lucide-react";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { TeacherRewardWorkspaceTabs } from "@/components/dashboard/teacher/TeacherRewardWorkspaceTabs";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { awardRecognition, CHARACTER_BADGES } from "@/lib/community/recognition";
import { pointDayKey } from "@/lib/community/point-awards";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

const WEEKLY_BADGE_KEY = "MUMIN_OF_WEEK";
const MANUAL = CHARACTER_BADGES.filter((badge) => !["RELIABLE", "CONSISTENT", "SEEKER", WEEKLY_BADGE_KEY].includes(badge.key));
const BONUS: Record<string, number> = { MUMIN_OF_WEEK: 25, HELPER: 10, COURAGEOUS: 10, NOTICER: 10, TRUTH_TELLER: 10, LEADER: 15, HOUSE_BUILDER: 30, ALLIANCE_CHAMPION: 40 };

type Props = { searchParams?: Promise<{ awarded?: string; error?: string; certificate?: string }> };

function weekKey(value = new Date()) {
  const [year, month, day] = pointDayKey(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export default async function TeacherRecognitionPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const students = Array.from(new Map(dashboard.rosters.flatMap((roster) => roster.students).map((student) => [student.id, student])).values()).sort((a, b) => a.name.localeCompare(b.name));

  async function nominate(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    const currentDashboard = await getTeacherDashboardData(current.user.id);
    if (!currentDashboard) redirect("/teacher-registration");

    const studentId = String(formData.get("studentId") || "");
    const badgeKey = String(formData.get("badgeKey") || "");
    const evidence = String(formData.get("evidence") || "").trim().slice(0, 500);
    const beneficiaryStudentId = String(formData.get("beneficiaryStudentId") || "") || undefined;
    const weekly = badgeKey === WEEKLY_BADGE_KEY;
    const permittedBadges = new Set([...MANUAL.map((badge) => badge.key), WEEKLY_BADGE_KEY]);
    const eligible = new Set(currentDashboard.rosters.flatMap((roster) => roster.students.map((student) => student.id)));

    if (!eligible.has(studentId) || (beneficiaryStudentId && !eligible.has(beneficiaryStudentId)) || !permittedBadges.has(badgeKey) || evidence.length < 12) {
      redirect("/teacher/recognition?error=Choose%20a%20roster%20student%20and%20write%20a%20specific%20reason%20of%20at%20least%2012%20characters.");
    }

    const award = await awardRecognition({
      studentId,
      badgeKey,
      evidence,
      awardedByUserId: current.user.id,
      sourceType: weekly ? "WEEKLY_NOMINATION" : "TEACHER_NOMINATION",
      sourceId: weekly ? `${current.user.id}:${weekKey()}` : `${current.user.id}:${badgeKey}:${pointDayKey()}`,
      pointsBonus: BONUS[badgeKey] ?? 10,
      featuredWeek: weekly ? weekKey() : undefined,
      beneficiaryStudentId: weekly ? undefined : beneficiaryStudentId,
    });

    revalidatePath("/teacher/recognition");
    revalidatePath("/student/rewards");
    revalidatePath("/parent/rewards");
    revalidatePath(`/certificates/${award.certificateCode}`);
    redirect(`/teacher/recognition?awarded=1${weekly ? `&certificate=${award.certificateCode}` : ""}`);
  }

  return (
    <TeacherDashboardFrame title="Live Points & Recognition" subtitle="Award fair live-class points, character badges, and a printable Mumin of the Week certificate from one workspace." navItems={getTeacherNavItems()}>
      <ActionToast message={params.awarded ? "Recognition awarded, certificate created, House points added, and the learner's family notified." : params.error} tone={params.error ? "error" : "success"} />
      <TeacherRewardWorkspaceTabs active="recognition" />
      <TeacherMetricGrid metrics={[
        { label: "Roster students", value: String(students.length), hint: "Unique eligible learners." },
        { label: "Weekly certificate", value: "Ready", hint: "Reason is required and printed." },
        { label: "Family alert", value: "Automatic", hint: "Portal notification and deliverable email." },
        { label: "Print / PDF", value: "Included", hint: "Open after awarding." },
      ]} />

      <TeacherSection eyebrow="Weekly recognition" title="Award Mumin of the Week">
        <div className="mb-5 grid gap-3 rounded-[24px] border border-[#f0cd89] bg-gradient-to-r from-[#fff8e8] to-[#fffdf8] p-5 sm:grid-cols-[auto_1fr]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#172b49] text-[#f7bd59]"><Award className="h-7 w-7" /></span>
          <div><p className="font-black text-[#22304a]">Celebrate character—not points alone.</p><p className="mt-1 text-sm leading-6 text-[#617184]">Choose a learner you directly observed this week and write the exact reason. Their named certificate will appear immediately on the student and parent rewards dashboards.</p></div>
        </div>
        <form action={nominate} className="grid gap-4 lg:grid-cols-2">
          <input type="hidden" name="badgeKey" value={WEEKLY_BADGE_KEY} />
          <label className="grid gap-2 text-sm font-bold text-[#22304a]">Mumin of the Week
            <select name="studentId" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 font-normal"><option value="">Choose roster student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#22304a] lg:row-span-2">Reason printed on the certificate
            <textarea name="evidence" required minLength={12} maxLength={500} rows={5} placeholder="Example: For consistently helping classmates, preparing thoughtfully, and showing excellent adab throughout this week's sessions." className="h-full rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 font-normal" />
          </label>
          <button className="inline-flex w-fit items-center gap-2 rounded-full bg-[#172b49] px-6 py-3 text-sm font-bold text-white"><FileText className="h-4 w-4" />Award certificate</button>
        </form>
        {params.certificate ? <a href={`/certificates/${params.certificate}`} className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#d8a657] bg-[#fff8e8] px-5 py-3 text-sm font-bold text-[#172b49]"><CalendarDays className="h-4 w-4" />Open, print or save the awarded certificate</a> : null}
      </TeacherSection>

      <TeacherSection eyebrow="Character recognition" title="Award another meaningful badge">
        <form action={nominate} className="grid gap-4 lg:grid-cols-2">
          <select name="studentId" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3"><option value="">Choose roster student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select>
          <select name="badgeKey" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3"><option value="">Choose meaningful badge</option>{MANUAL.map((badge) => <option key={badge.key} value={badge.key}>{badge.title} — {BONUS[badge.key] ?? 10} House points</option>)}</select>
          <textarea name="evidence" required minLength={12} maxLength={500} rows={4} placeholder="Describe the specific action other children should copy." className="rounded-2xl border border-[#d8e3ed] px-4 py-3 lg:col-span-2" />
          <label className="grid gap-2 text-sm font-semibold text-[#22304a] lg:col-span-2">Learner helped in another Qabila (required for Qabila Builder / Alliance Champion)
            <select name="beneficiaryStudentId" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 font-normal"><option value="">Not a cross-Qabila award</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select>
          </label>
          <button className="inline-flex w-fit items-center gap-2 rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" />Award badge</button>
        </form>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}