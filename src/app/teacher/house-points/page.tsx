import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { awardHousePointsOnce, MANUAL_HOUSE_POINT_REASONS, pointDayKey, type ManualHousePointReason } from "@/lib/community/point-awards";
import { db } from "@/lib/db";
import { getProgramEligibleRosterStudents, getScheduleRosterStudentIds } from "@/lib/live-classes/service";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = { searchParams?: Promise<{ awarded?: string; duplicate?: string; updated?: string; removed?: string; error?: string }> };

async function notifyFamilyOfCorrection(studentId: string, title: string, body: string) {
  const student = await db.studentProfile.findUnique({ where: { id: studentId }, select: { userId: true, parents: { select: { parent: { select: { userId: true } } } } } });
  if (!student) return;
  const userIds = [...new Set([student.userId, ...student.parents.map((item) => item.parent.userId)])];
  await db.notification.createMany({ data: userIds.map((userId) => ({ userId, title, body, href: userId === student.userId ? "/student/rewards" : `/parent/rewards?child=${studentId}` })) });
}

export default async function TeacherHousePointsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!teacher) redirect("/teacher-registration");
  const students = Array.from(new Map(dashboard.rosters.flatMap((roster) => roster.students).map((student) => [student.id, student])).values()).sort((a, b) => a.name.localeCompare(b.name));
  const recentAwards = await db.housePointLedger.findMany({
    where: { points: { gt: 0 }, sourceType: { startsWith: "TEACHER_", not: "TEACHER_MANUAL_REVERSAL" }, sourceId: { startsWith: `${teacher.id}:` } },
    orderBy: { awardedAt: "desc" }, take: 30,
    include: { student: { include: { user: true, houseMembership: true } } },
  });
  const reversals = recentAwards.length ? await db.housePointLedger.findMany({ where: { sourceType: "TEACHER_MANUAL_REVERSAL", sourceId: { in: recentAwards.map((award) => award.id) } }, select: { sourceId: true } }) : [];
  const reversedIds = new Set(reversals.map((row) => row.sourceId));

  async function awardPoints(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    try {
      const currentTeacher = await db.teacherProfile.findUnique({ where: { userId: current.user.id }, select: { id: true } });
      if (!currentTeacher) throw new Error("Teacher profile was not found.");
      const scheduleId = String(formData.get("scheduleId") || "");
      const studentId = String(formData.get("studentId") || "");
      const reasonValue = String(formData.get("reason") || "") as ManualHousePointReason;
      const note = String(formData.get("note") || "").trim().slice(0, 180);
      const rule = MANUAL_HOUSE_POINT_REASONS.find((reason) => reason.value === reasonValue);
      if (!rule) throw new Error("Choose an approved house-point reason.");
      const schedule = await db.classSchedule.findFirst({ where: { id: scheduleId, teacherId: currentTeacher.id }, select: { id: true, programId: true } });
      if (!schedule) throw new Error("Choose one of your live sessions.");
      const [eligibleStudents, rosterIds] = await Promise.all([getProgramEligibleRosterStudents(schedule.programId), getScheduleRosterStudentIds(schedule.id)]);
      const eligibleIds = new Set(eligibleStudents.map((student) => student.id));
      if (!eligibleIds.has(studentId) || (rosterIds.length > 0 && !rosterIds.includes(studentId))) throw new Error("This student is not in the selected session roster.");
      const result = await awardHousePointsOnce({ studentId, points: rule.points, reason: rule.label + (note ? " - " + note : ""), sourceType: "TEACHER_" + rule.value, sourceId: `${currentTeacher.id}:${schedule.id}:${rule.value}:${pointDayKey()}`, notificationHref: "/student/rewards" });
      revalidatePath("/teacher/house-points"); revalidatePath("/student/rewards"); revalidatePath("/parent/rewards");
      redirect(result.awarded ? "/teacher/house-points?awarded=1" : "/teacher/house-points?duplicate=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to award points.";
      redirect(`/teacher/house-points?error=${encodeURIComponent(message)}`);
    }
  }

  async function updateAward(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    try {
      const currentTeacher = await db.teacherProfile.findUnique({ where: { userId: current.user.id }, select: { id: true } });
      if (!currentTeacher) throw new Error("Teacher profile was not found.");
      const awardId = String(formData.get("awardId") || "");
      const reasonValue = String(formData.get("reason") || "") as ManualHousePointReason;
      const note = String(formData.get("note") || "").trim().slice(0, 180);
      const rule = MANUAL_HOUSE_POINT_REASONS.find((reason) => reason.value === reasonValue);
      const award = await db.housePointLedger.findFirst({ where: { id: awardId, points: { gt: 0 }, sourceType: { startsWith: "TEACHER_", not: "TEACHER_MANUAL_REVERSAL" }, sourceId: { startsWith: `${currentTeacher.id}:` } } });
      if (!award || !rule) throw new Error("This live award cannot be edited.");
      const reversed = await db.housePointLedger.findFirst({ where: { sourceType: "TEACHER_MANUAL_REVERSAL", sourceId: award.id } });
      if (reversed) throw new Error("A removed award cannot be edited.");
      const parts = (award.sourceId || "").split(":");
      if (parts.length < 4) throw new Error("The award source is incomplete.");
      await db.housePointLedger.update({ where: { id: award.id }, data: { points: rule.points, reason: rule.label + (note ? " - " + note : ""), sourceType: `TEACHER_${reasonValue}`, sourceId: `${currentTeacher.id}:${parts[1]}:${reasonValue}:${parts[3]}` } });
      await notifyFamilyOfCorrection(award.studentId, "House points updated", `A teacher corrected a live-class award to ${rule.points} points: ${rule.label}.`);
      revalidatePath("/teacher/house-points"); revalidatePath("/student/rewards"); revalidatePath("/parent/rewards");
      redirect("/teacher/house-points?updated=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update points.";
      redirect(`/teacher/house-points?error=${encodeURIComponent(message)}`);
    }
  }

  async function removeAward(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    try {
      const currentTeacher = await db.teacherProfile.findUnique({ where: { userId: current.user.id }, select: { id: true } });
      if (!currentTeacher) throw new Error("Teacher profile was not found.");
      const award = await db.housePointLedger.findFirst({ where: { id: String(formData.get("awardId") || ""), points: { gt: 0 }, sourceType: { startsWith: "TEACHER_", not: "TEACHER_MANUAL_REVERSAL" }, sourceId: { startsWith: `${currentTeacher.id}:` } } });
      if (!award) throw new Error("This live award cannot be removed.");
      await db.housePointLedger.create({ data: { houseId: award.houseId, studentId: award.studentId, points: -award.points, reason: `Teacher removed live award: ${award.reason}`, sourceType: "TEACHER_MANUAL_REVERSAL", sourceId: award.id } });
      await notifyFamilyOfCorrection(award.studentId, "House points corrected", `A teacher removed a ${award.points}-point live-class award. The points total has been corrected.`);
      revalidatePath("/teacher/house-points"); revalidatePath("/student/rewards"); revalidatePath("/parent/rewards");
      redirect("/teacher/house-points?removed=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove points.";
      redirect(`/teacher/house-points?error=${encodeURIComponent(message)}`);
    }
  }

  const toast = params.awarded ? "House points awarded and the family was notified." : params.duplicate ? "Already awarded for this student, session, reason, and day." : params.updated ? "Live award updated and the family was notified." : params.removed ? "Live award removed; totals were reversed safely." : params.error;
  return <TeacherDashboardFrame title="Live House Points" subtitle="Award fixed, auditable points during class, then review and correct your recent awards." navItems={getTeacherNavItems()}>
    <ActionToast message={toast} tone={params.error || params.duplicate ? "error" : "success"}/>
    <TeacherMetricGrid metrics={[{label:"Students",value:String(students.length),hint:"Eligible roster learners."},{label:"Live sessions",value:String(dashboard.classes.length),hint:"Choose where it happened."},{label:"Approved reasons",value:String(MANUAL_HOUSE_POINT_REASONS.length),hint:"Fixed fair values."},{label:"Recent awards",value:String(recentAwards.length),hint:"Your auditable history."}]}/>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <TeacherSection eyebrow="Live award" title="Recognise a student contribution">
        <form action={awardPoints} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Live session<select name="scheduleId" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3"><option value="">Choose session</option>{dashboard.classes.map((item)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Student<select name="studentId" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3"><option value="">Choose student</option>{students.map((student)=><option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Reason and fixed points<select name="reason" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3"><option value="">Choose observed behaviour</option>{MANUAL_HOUSE_POINT_REASONS.map((reason)=><option key={reason.value} value={reason.value}>{reason.label} - {reason.points} points</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Short observation note<input name="note" maxLength={180} required placeholder="What did you observe?" className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3"/></label>
          <button className="w-fit rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white">Award points</button>
        </form>
      </TeacherSection>
      <TeacherSection eyebrow="Recent live awards" title="Review and correct">
        <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
          {recentAwards.map((award)=>{const removed=reversedIds.has(award.id);const reasonValue=award.sourceType.replace("TEACHER_","") as ManualHousePointReason;return <article key={award.id} className={`rounded-2xl border p-4 ${removed?"border-[#efcaca] bg-[#fff5f5] opacity-70":"border-[#eadfce] bg-[#fffaf4]"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#22304a]">{award.student.displayName || `${award.student.user.firstName} ${award.student.user.lastName}`.trim()}</p><p className="mt-1 text-sm text-[#617184]">{award.reason}</p><p className="mt-2 text-xs text-[#7a8797]">{award.awardedAt.toLocaleString("en-GB")}</p></div><span className={`rounded-full px-3 py-1 text-sm font-bold ${removed?"bg-[#fde2e2] text-[#a63e3e]":"bg-[#eaf6ed] text-[#2f6b4b]"}`}>{removed?"Removed":`+${award.points}`}</span></div>{!removed?<details className="mt-3 border-t border-[#eadfce] pt-3"><summary className="cursor-pointer text-xs font-bold text-[#0f4d81]">Edit or remove award</summary><form action={updateAward} className="mt-3 grid gap-2"><input type="hidden" name="awardId" value={award.id}/><select name="reason" defaultValue={reasonValue} className="rounded-xl border border-[#d8e3ed] bg-white px-3 py-2 text-sm">{MANUAL_HOUSE_POINT_REASONS.map((reason)=><option key={reason.value} value={reason.value}>{reason.label} - {reason.points}</option>)}</select><input name="note" maxLength={180} placeholder="Corrected observation note" className="rounded-xl border border-[#d8e3ed] bg-white px-3 py-2 text-sm"/><div className="flex flex-wrap gap-2"><button className="rounded-full bg-[#0f4d81] px-3 py-2 text-xs font-bold text-white">Save correction</button></div></form><form action={removeAward} className="mt-2"><input type="hidden" name="awardId" value={award.id}/><button className="rounded-full border border-[#efb3b3] px-3 py-2 text-xs font-bold text-[#b24646]">Remove and reverse points</button></form></details>:null}</article>})}
          {!recentAwards.length?<p className="rounded-2xl bg-[#fbf6ef] p-4 text-sm text-[#617184]">Awards you give during class will appear here immediately.</p>:null}
        </div>
      </TeacherSection>
    </div>
  </TeacherDashboardFrame>;
}