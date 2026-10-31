import { CertificatePublicField, CertificatePublicationControl, HideWeeklyCertificates } from "@/components/dashboard/teacher/CertificatePublication";
import { setCertificatePublication } from "@/lib/community/certificate-publication";
import { refreshCertificatePortals } from "@/app/teacher/certificate-actions";
import { BADGE_POINT_BONUSES } from "@/lib/community/recognition-points";
import { canAwardWeeklyCertificates } from "@/lib/teacher/recognition-permissions";
import { AwardBadgeForm } from "@/components/dashboard/teacher/AwardBadgeForm";
import { TeacherBadgeOverview } from "@/components/dashboard/teacher/TeacherBadgeOverview";
import { RecognitionWeekSelector } from "@/components/dashboard/teacher/RecognitionWeekSelector";
import { currentRecognitionWeek, validRecognitionWeek, recognitionWeekLabel } from "@/lib/community/recognition-week";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Award, CalendarDays, FileText, Trash2 } from "lucide-react";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { TeacherRewardWorkspaceTabs } from "@/components/dashboard/teacher/TeacherRewardWorkspaceTabs";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { awardRecognition, CHARACTER_BADGES } from "@/lib/community/recognition";
import { pointDayKey } from "@/lib/community/point-awards";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { db } from "@/lib/db";
import { RosterAwards, type RosterAwardFilters } from "@/components/dashboard/teacher/RosterAwards";

const WEEKLY_BADGE_KEY = "MUMIN_OF_WEEK";
const MANUAL = CHARACTER_BADGES.filter((badge) => !["RELIABLE", "CONSISTENT", "SEEKER", WEEKLY_BADGE_KEY].includes(badge.key));
const BONUS = BADGE_POINT_BONUSES;

type Props = { searchParams?: Promise<RosterAwardFilters & { awarded?: string; removed?: string; error?: string; certificate?: string; tab?: string; badge?: string }> };



export default async function TeacherRecognitionPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const canAwardCertificates = canAwardWeeklyCertificates(session.user);
  const certificateTab = params.tab === "certificate" || Boolean(params.certificate);
  if (certificateTab && !canAwardCertificates) redirect("/teacher/recognition?error=Weekly%20certificates%20are%20awarded%20by%20Sister%20Saba%20or%20Ustadh%20Mehran.");
  const selectedBadge = MANUAL.some((badge) => badge.key === params.badge) ? params.badge : "";
  const students = Array.from(new Map(dashboard.rosters.flatMap((roster) => roster.students).map((student) => [student.id, student])).values()).sort((a, b) => a.name.localeCompare(b.name));
  const recentAwards = await db.recognitionAward.findMany({
    where: { ...(certificateTab ? { badgeKey: WEEKLY_BADGE_KEY } : { awardedByUserId: session.user.id, sourceType: "TEACHER_NOMINATION", isPublic: true }), revokedAt: null },
    orderBy: { awardedAt: "desc" },
    ...(certificateTab ? {} : { take: 20 }),
    include: { student: { include: { user: true } } },
  });

  async function nominate(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    const currentDashboard = await getTeacherDashboardData(current.user.id);
    if (!currentDashboard) redirect("/teacher-registration");

    const studentId = String(formData.get("studentId") || "");
    const badgeKey = String(formData.get("badgeKey") || "");
    const certificateAward = formData.get("awardKind") === "certificate";
    if (certificateAward && !canAwardWeeklyCertificates(current.user)) redirect("/teacher/recognition?error=You%20do%20not%20have%20permission%20to%20award%20weekly%20certificates.");
    const evidence = String(formData.get("evidence") || "").trim().slice(0, certificateAward ? 240 : 500);
    const recipientName = certificateAward ? String(formData.get("recipientName") || "").trim().replace(/\s+/g, " ").slice(0, 80) : undefined;
    const beneficiaryStudentId = String(formData.get("beneficiaryStudentId") || "") || undefined;
    const weekly = certificateAward;
    const errorBase = weekly ? "/teacher/recognition?tab=certificate&error=" : "/teacher/recognition?error=";
    const selectedWeek = String(formData.get("featuredWeek") || "");
    if (weekly && !validRecognitionWeek(selectedWeek)) redirect(errorBase + encodeURIComponent("Choose a valid current or past week."));
    const permittedBadges = new Set(weekly ? [WEEKLY_BADGE_KEY] : MANUAL.map((badge) => badge.key));
    const eligible = new Set(currentDashboard.rosters.flatMap((roster) => roster.students.map((student) => student.id)));

    if (!eligible.has(studentId) || (beneficiaryStudentId && !eligible.has(beneficiaryStudentId)) || !permittedBadges.has(badgeKey) || evidence.length < 12) {
      redirect(errorBase + encodeURIComponent("Choose a roster student and badge, and write a specific reason of at least 12 characters."));
    }

    if (["HOUSE_BUILDER", "ALLIANCE_CHAMPION"].includes(badgeKey)) {
      if (!beneficiaryStudentId || beneficiaryStudentId === studentId) redirect(errorBase + encodeURIComponent("Choose a different learner who benefited from this action."));
      const memberships = await db.houseMembership.findMany({ where: { studentId: { in: [studentId, beneficiaryStudentId] } }, select: { studentId: true, qabilaGroup: true } });
      const own = memberships.find(item => item.studentId === studentId)?.qabilaGroup;
      const other = memberships.find(item => item.studentId === beneficiaryStudentId)?.qabilaGroup;
      if (!own || !other || own === other) redirect(errorBase + encodeURIComponent("This badge needs a learner from a different assigned Qabila."));
    }

    const award = await awardRecognition({
      studentId,
      badgeKey,
      evidence,
      recipientName,
      awardedByUserId: current.user.id,
      sourceType: weekly ? "WEEKLY_NOMINATION" : "TEACHER_NOMINATION",
      sourceId: weekly ? `${current.user.id}:${badgeKey}:${selectedWeek}` : `${current.user.id}:${badgeKey}:${pointDayKey()}`,
      pointsBonus: BONUS[badgeKey] ?? 10,
      featuredWeek: weekly ? selectedWeek : undefined,
      beneficiaryStudentId: weekly ? undefined : beneficiaryStudentId,
    });

    if (weekly) await setCertificatePublication({ userId: current.user.id, awardId: award.id, parent: false, isPublic: formData.get("isPublic") === "on" });
    await refreshCertificatePortals();
    revalidatePath("/teacher/recognition");
    revalidatePath("/student/rewards");
    revalidatePath("/parent/rewards");
    revalidatePath(`/certificates/${award.certificateCode}`);
    revalidatePath(`/badges/${award.certificateCode}`);
    revalidatePath("/admin/rewards");
    redirect(`/teacher/recognition?awarded=1${weekly ? `&certificate=${award.certificateCode}` : ""}`);
  }

  async function removeAward(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    const awardId = String(formData.get("awardId") || "");
    const award = await db.recognitionAward.findFirst({ where: { id: awardId, awardedByUserId: current.user.id, sourceType: { in: ["WEEKLY_NOMINATION", "TEACHER_NOMINATION"] }, revokedAt: null } });
    if (!award) redirect("/teacher/recognition?error=Award%20not%20found%20or%20you%20do%20not%20have%20permission%20to%20remove%20it.");
    await db.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { href: `/certificates/${award.certificateCode}` } });
      await tx.housePointLedger.deleteMany({ where: { sourceId: award.id, studentId: { in: [award.studentId, ...(award.beneficiaryStudentId ? [award.beneficiaryStudentId] : [])] } } });
      await tx.recognitionAward.delete({ where: { id: award.id } });
    });
    revalidatePath("/teacher/recognition"); revalidatePath("/student"); revalidatePath("/student/rewards"); revalidatePath("/parent"); revalidatePath("/parent/rewards"); revalidatePath(`/certificates/${award.certificateCode}`);
    redirect("/teacher/recognition?removed=1");
  }
  return (
    <TeacherDashboardFrame title={canAwardCertificates ? "Badges, Certificates & Points" : "Badges & Live Points"} subtitle={canAwardCertificates ? "Award student badges, class points and weekly certificates." : "Recognise student character and award fair points during class."} navItems={getTeacherNavItems()}>
      <ActionToast message={params.awarded ? (certificateTab ? "Certificate saved. Its visibility is shown in the certificate history." : "Badge awarded. The learner can find it in their rewards.") : params.removed ? "Award, certificate, and its related House points removed." : params.error} tone={params.error ? "error" : "success"} />
      <TeacherRewardWorkspaceTabs active={certificateTab ? "certificate" : "recognition"} canAwardCertificates={canAwardCertificates} />
      <TeacherMetricGrid metrics={[
        { label: "Roster students", value: String(students.length), hint: "Unique eligible learners." },
        certificateTab ? { label: "Weekly Qabila bonus", value: "150 pts", hint: "Added only while the certificate is public." } : { label: "Character badges", value: String(MANUAL.length), hint: "Choose a badge for an action you observed." },
        { label: "Family alert", value: certificateTab ? "On publish" : "Automatic", hint: "Portal notification and deliverable email." },
        certificateTab ? { label: "Print / PDF", value: "Included", hint: "Open after awarding." } : { label: "Badge guide", value: "Below", hint: "See what each badge recognises." },
      ]} />

      {certificateTab ? <TeacherSection eyebrow="Weekly recognition" title="Award Mumin of the Week">
        <div className="mb-5 grid gap-3 rounded-[24px] border border-[#f0cd89] bg-gradient-to-r from-[#fff8e8] to-[#fffdf8] p-5 sm:grid-cols-[auto_1fr]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#172b49] text-[#f7bd59]"><Award className="h-7 w-7" /></span>
          <div><p className="font-black text-[#22304a]">Celebrate character—not points alone.</p><p className="mt-1 text-sm leading-6 text-[#617184]">Choose a learner you directly observed during the selected week and write the exact reason. Save privately first, or tick Make certificate public now when you are ready to notify the family.</p></div>
        </div>
        <form action={nominate} className="grid gap-4 lg:grid-cols-2">
          <input type="hidden" name="awardKind" value="certificate" /><RecognitionWeekSelector currentWeek={currentRecognitionWeek()} currentMonth={pointDayKey().slice(0,7)} />
          <label className="grid gap-2 text-sm font-bold text-[#22304a]">Certificate recipient
            <select name="studentId" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 font-normal"><option value="">Choose roster student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select>
          </label>
          <input type="hidden" name="badgeKey" value={WEEKLY_BADGE_KEY} />
          <label className="grid gap-2 text-sm font-bold text-[#22304a] lg:col-span-2">Student name shown on certificate
            <input name="recipientName" maxLength={80} placeholder="Optional - enter the student's full name" className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 font-normal" />
            <span className="text-xs font-normal text-[#7a8797]">Leave blank to use the selected student&apos;s name. This changes only the certificate name, not the student profile.</span>
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#22304a] lg:col-span-2">Short reason printed on the certificate
            <textarea name="evidence" required minLength={12} maxLength={240} rows={4} placeholder="Example: For consistently helping classmates and showing excellent adab throughout this week's sessions." className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 font-normal" />
            <span className="text-xs font-normal text-[#7a8797]">Keep it clear and concise (maximum 240 characters). This exact reason appears on the learner&apos;s dashboard and certificate.</span>
          </label>
          <CertificatePublicField /><FormSubmitButton pendingLabel="Awarding certificate..." className="inline-flex w-fit items-center gap-2 rounded-full bg-[#172b49] px-6 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"><FileText className="h-4 w-4" />Save certificate</FormSubmitButton>
        </form>
        {params.certificate ? <a href={`/certificates/${params.certificate}`} className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#d8a657] bg-[#fff8e8] px-5 py-3 text-sm font-bold text-[#172b49]"><CalendarDays className="h-4 w-4" />Open, print or save the awarded certificate</a> : null}
      </TeacherSection>
      : <TeacherSection eyebrow="Character recognition" title="Award a student badge">
        <p className="mb-4 text-sm text-[#617184]">Choose a student, select the character you observed, and describe what they did.</p>
        <AwardBadgeForm key={selectedBadge} action={nominate} students={students.map(student => ({ id: student.id, name: student.name }))} badges={MANUAL} bonuses={BONUS} initialBadge={selectedBadge ?? ""} />
      </TeacherSection>}
      {!certificateTab ? <TeacherBadgeOverview canAwardCertificates={canAwardCertificates} /> : null}
      <RosterAwards students={students.map(({ id, name }) => ({ id, name }))} filters={params} />
      {certificateTab ? <HideWeeklyCertificates /> : null}
      <TeacherSection eyebrow="Teacher award history" title={certificateTab ? "My recent weekly certificates" : "My recent student badges"}>
        <p className="mb-4 text-sm leading-6 text-[#617184]">You can remove an award you created while testing. Its certificate will be hidden and its awarded House points will be safely reversed.</p>
        <div className="grid gap-3">
          {recentAwards.map((award) => {
            const learnerName = award.recipientName || award.student.displayName || `${award.student.user.firstName} ${award.student.user.lastName ?? ""}`.trim();
            return <article key={award.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dce4ed] bg-[#f8fafc] p-4"><div><p className="font-black text-[#22304a]">{award.title} · {learnerName}</p><p className="mt-1 text-sm text-[#617184]">{award.featuredWeek ? <span className="block font-semibold">Week: {recognitionWeekLabel(award.featuredWeek)}</span> : null}{award.evidence}</p><p className="mt-1 text-xs text-[#8793a3]">{award.awardedAt.toLocaleDateString("en-GB")} · {award.pointsBonus} {certificateTab && !award.isPublic ? "points when published" : "points"}</p></div><div className="flex flex-wrap items-center gap-2">{certificateTab ? <CertificatePublicationControl id={award.id} isPublic={award.isPublic} /> : null}<a href={certificateTab ? `/certificates/${award.certificateCode}` : `/badges/${award.certificateCode}`} className="rounded-full border border-[#c8d5e3] bg-white px-4 py-2 text-xs font-bold text-[#24466e]">{certificateTab ? "Open certificate" : "View badge"}</a><details className="relative"><summary className="cursor-pointer list-none rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-xs font-bold text-[#b24646]">Remove</summary><form action={removeAward} className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-[#efb3b3] bg-white p-4 shadow-xl"><input type="hidden" name="awardId" value={award.id}/><p className="text-xs leading-5 text-[#617184]">Remove this certificate and reverse its awarded points?</p><button className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#b24646] px-4 py-2 text-xs font-bold text-white"><Trash2 className="h-3.5 w-3.5"/>Yes, remove award</button></form></details></div></article>;
          })}
          {!recentAwards.length ? <p className="rounded-2xl bg-[#f8fafc] p-5 text-sm text-[#617184]">You have not assigned any certificates or badges yet.</p> : null}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
