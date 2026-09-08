import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Award, ChevronDown, Clock3, Sparkles, TrendingUp, Trophy } from "lucide-react";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { ActivityShortcutLink } from "@/components/dashboard/family/ActivityShortcutLink";
import { getCurrentSession } from "@/lib/auth/session";
import { QABILA_NAMES, canonicalQabilaName, qabilaProfile } from "@/lib/community/qabilas";
import { HOUSE_UNLOCKS } from "@/lib/community/recognition";
import { db } from "@/lib/db";

type Props = { searchParams?: Promise<{ notice?: string; tone?: string; qabila?: string }> };
const go = (notice: string, tone: "success" | "error" = "success") => "/admin/rewards?" + new URLSearchParams({ notice, tone });
const studentName = (student: { displayName: string | null; user: { firstName: string; lastName: string | null } }) => student.displayName || `${student.user.firstName} ${student.user.lastName || ""}`.trim();
const dayMs = 24 * 60 * 60 * 1000;

function sourceLabel(source: string) {
  if (source.startsWith("SUNNAH")) return "Sunnah tracker";
  if (source.startsWith("FARDH")) return "Fardh tracker";
  if (source.includes("ATTENDANCE")) return "Attendance";
  if (source.includes("QUIZ")) return "Quiz";
  if (source.includes("HOMEWORK")) return "Learning task";
  if (source.includes("RECOGNITION") || source.includes("CROSS_HOUSE")) return "Recognition";
  return source.replaceAll("_", " ").toLowerCase();
}

export default async function Page({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");
  const params = searchParams ? await searchParams : {};
  const requestedQabila = canonicalQabilaName(params.qabila);
  const activeQabila = requestedQabila || QABILA_NAMES[0];
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * dayMs);
  const dayStart = new Date(now.getTime() - dayMs);

  const totals = await db.housePointLedger.groupBy({ by: ["houseId"], _sum: { points: true } });
  for (const row of totals) {
    for (const item of HOUSE_UNLOCKS.filter((entry) => (row._sum.points ?? 0) >= entry.milestone)) {
      await db.houseUnlock.upsert({ where: { houseId_milestone: { houseId: row.houseId, milestone: item.milestone } }, create: { houseId: row.houseId, ...item, unlockedAt: new Date() }, update: {} });
    }
  }

  const [studentPointTotals, memberships, recentLedger, awards, unlocks, rewardNotifications] = await Promise.all([
    db.housePointLedger.groupBy({ by: ["studentId"], _sum: { points: true } }),
    db.houseMembership.findMany({ where: { qabilaGroup: { not: null } }, select: { studentId: true, qabilaGroup: true } }),
    db.housePointLedger.findMany({ orderBy: { awardedAt: "desc" }, take: 300, include: { student: { include: { user: true, houseMembership: true } } } }),
    db.recognitionAward.findMany({ orderBy: { awardedAt: "desc" }, take: 150, include: { student: { include: { user: true, houseMembership: { include: { house: true } } } } } }),
    db.houseUnlock.findMany({ orderBy: [{ claimedAt: "asc" }, { unlockedAt: "desc" }], include: { house: true } }),
    db.notification.findMany({ where: { userId: session.user.id, readAt: null, href: { startsWith: "/admin/rewards" } }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, title: true, body: true, href: true } }),
  ]);

  const membershipByStudent = new Map(memberships.map((membership) => [membership.studentId, canonicalQabilaName(membership.qabilaGroup)]));
  const qabilaTotals = new Map(QABILA_NAMES.map((qabila) => [qabila, 0]));
  for (const row of studentPointTotals) {
    const qabila = membershipByStudent.get(row.studentId);
    if (qabila) qabilaTotals.set(qabila, (qabilaTotals.get(qabila) ?? 0) + (row._sum.points ?? 0));
  }

  const unreadByQabila = new Map(QABILA_NAMES.map((qabila) => [qabila, [] as string[]]));
  for (const notification of rewardNotifications) {
    try {
      const qabila = canonicalQabilaName(new URL(notification.href || "", "https://genmumin.local").searchParams.get("qabila"));
      if (qabila) unreadByQabila.set(qabila, [...(unreadByQabila.get(qabila) ?? []), notification.id]);
    } catch {}
  }

  const summaries = QABILA_NAMES.map((qabila) => {
    const activity = recentLedger.filter((entry) => canonicalQabilaName(entry.student.houseMembership?.qabilaGroup) === qabila);
    const qabilaAwards = awards.filter((award) => canonicalQabilaName(award.student.houseMembership?.qabilaGroup) === qabila);
    return {
      name: qabila,
      profile: qabilaProfile(qabila)!,
      points: qabilaTotals.get(qabila) ?? 0,
      weeklyGrowth: activity.filter((entry) => entry.awardedAt >= weekStart).reduce((sum, entry) => sum + entry.points, 0),
      activityToday: activity.filter((entry) => entry.awardedAt >= dayStart).length,
      badges: qabilaAwards.filter((award) => !award.revokedAt).length,
      members: memberships.filter((membership) => canonicalQabilaName(membership.qabilaGroup) === qabila).length,
      unreadIds: unreadByQabila.get(qabila) ?? [],
      latest: activity[0] || null,
    };
  });
  const activeSummary = summaries.find((summary) => summary.name === activeQabila)!;
  const activeLedger = recentLedger.filter((entry) => canonicalQabilaName(entry.student.houseMembership?.qabilaGroup) === activeQabila).slice(0, 40);
  const activeAwards = awards.filter((award) => canonicalQabilaName(award.student.houseMembership?.qabilaGroup) === activeQabila).slice(0, 24);
  const overallPoints = summaries.reduce((sum, item) => sum + item.points, 0);
  const overallGrowth = summaries.reduce((sum, item) => sum + item.weeklyGrowth, 0);
  const todayActivity = summaries.reduce((sum, item) => sum + item.activityToday, 0);
  const overviewMetrics: Array<{ label: string; value: string | number; icon: typeof Trophy }> = [
    { label: "All Qabila points", value: overallPoints, icon: Trophy },
    { label: "Growth · 7 days", value: `+${overallGrowth}`, icon: TrendingUp },
    { label: "Activities · 24 hours", value: todayActivity, icon: Sparkles },
    { label: "Active badges", value: awards.filter((award) => !award.revokedAt).length, icon: Award },
  ];

  async function revoke(formData: FormData) {
    "use server";
    const admin = await getCurrentSession();
    if (!admin || admin.user.role !== "ADMIN") redirect("/admin");
    const id = String(formData.get("awardId") || "");
    const award = await db.recognitionAward.findUnique({ where: { id } });
    if (!award) redirect(go("Recognition not found.", "error"));
    if (award.revokedAt) redirect(go("Recognition was already revoked.", "error"));
    await db.$transaction(async (tx) => {
      await tx.recognitionAward.update({ where: { id }, data: { isPublic: false, revokedAt: new Date(), revokedByUserId: admin.user.id } });
      const original = await tx.housePointLedger.findFirst({ where: { studentId: award.studentId, sourceId: id, sourceType: "RECOGNITION_" + award.badgeKey } });
      const reversed = await tx.housePointLedger.findFirst({ where: { studentId: award.studentId, sourceId: id, sourceType: "RECOGNITION_REVERSAL" } });
      if (original && !reversed && original.points > 0) await tx.housePointLedger.create({ data: { houseId: original.houseId, studentId: original.studentId, points: -original.points, reason: "Revoked: " + award.title, sourceType: "RECOGNITION_REVERSAL", sourceId: id } });
      if (award.beneficiaryStudentId) {
        const other = await tx.housePointLedger.findFirst({ where: { studentId: award.beneficiaryStudentId, sourceId: id, sourceType: { startsWith: "CROSS_HOUSE_" } } });
        const undone = await tx.housePointLedger.findFirst({ where: { studentId: award.beneficiaryStudentId, sourceId: id, sourceType: "CROSS_HOUSE_REVERSAL" } });
        if (other && !undone && other.points > 0) await tx.housePointLedger.create({ data: { houseId: other.houseId, studentId: other.studentId, points: -other.points, reason: "Revoked cross-Qabila award: " + award.title, sourceType: "CROSS_HOUSE_REVERSAL", sourceId: id } });
      }
    });
    revalidatePath("/admin/rewards");
    revalidatePath("/student/rewards");
    revalidatePath("/parent/rewards");
    redirect(go("Recognition revoked and awarded points safely reversed."));
  }

  async function claim(formData: FormData) {
    "use server";
    const admin = await getCurrentSession();
    if (!admin || admin.user.role !== "ADMIN") redirect("/admin");
    await db.houseUnlock.update({ where: { id: String(formData.get("unlockId") || "") }, data: { claimedAt: new Date() } });
    revalidatePath("/admin/rewards");
    redirect(go("Qabila reward marked as delivered."));
  }

  return <main className="min-h-screen bg-[#edf2f6] py-6"><div className="section-container space-y-5">
    <ActionToast message={params.notice} tone={params.tone} />
    <header className="overflow-hidden rounded-[28px] bg-[#172842] p-6 text-white shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#f4bd72]">Admin reward intelligence</p><h1 className="mt-2 text-3xl font-black">Qabila House Points & Recognition</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#cfdaea]">One transparent view of verified point growth, student contributions, automatic badges, and teacher-awarded recognition.</p></div><div className="flex gap-2"><Link href="/admin/community" className="rounded-full border border-white/25 px-4 py-2 text-sm font-bold">Community</Link><Link href="/admin" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#172842]">Admin home</Link></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{overviewMetrics.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl bg-white/10 p-4"><Icon className="h-5 w-5 text-[#ffd17c]"/><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="text-xs text-white/65">{label}</p></div>)}</div>
    </header>

    <section className="rounded-[26px] border border-[#dce4ed] bg-white p-4 shadow-sm sm:p-5">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b66922]">Qabila tabs</p><h2 className="mt-1 text-xl font-black text-[#22304a]">Choose a Qabila to review</h2><p className="mt-1 text-sm text-[#617184]">Red counts identify recent unread reward activity. Hover a tab for its latest contribution.</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{summaries.map((summary) => <ActivityShortcutLink key={summary.name} href={`/admin/rewards?qabila=${encodeURIComponent(summary.name)}`} notificationIds={summary.unreadIds} alertText={summary.latest ? `${studentName(summary.latest.student)}: +${summary.latest.points} · ${summary.latest.reason}` : "No recent point activity"} className={`relative block rounded-[22px] border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${summary.name === activeQabila ? "shadow-md" : "bg-[#fbfcfe]"}`}>
        <div className="flex items-center gap-3"><Image src={summary.profile.image} alt={`${summary.name} profile`} width={52} height={52} className="h-13 w-13 rounded-full object-cover"/><div className="min-w-0"><p className="truncate font-black text-[#22304a]">{summary.name}</p><p className="text-xs text-[#617184]">{summary.profile.mentor}</p></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="font-black text-[#22304a]">{summary.points}</p><p className="text-[10px] text-[#718096]">points</p></div><div><p className="font-black text-[#2f7a4f]">+{summary.weeklyGrowth}</p><p className="text-[10px] text-[#718096]">7 days</p></div><div><p className="font-black text-[#22304a]">{summary.badges}</p><p className="text-[10px] text-[#718096]">badges</p></div></div>
      </ActivityShortcutLink>)}</div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
      ["Current points", activeSummary.points, "Verified collective total"], ["Seven-day growth", `+${activeSummary.weeklyGrowth}`, "Net ledger movement"], ["Qabila members", activeSummary.members, "Current team membership"], ["Recognition earned", activeSummary.badges, "Active badges and awards"],
    ].map(([label, value, hint]) => <div key={String(label)} className="rounded-[22px] border border-[#dce4ed] bg-white p-5"><p className="text-3xl font-black text-[#22304a]">{String(value)}</p><p className="mt-1 font-bold text-[#46566a]">{String(label)}</p><p className="mt-1 text-xs text-[#7a8797]">{String(hint)}</p></div>)}</section>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <section className="rounded-[26px] border border-[#dce4ed] bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b66922]">Point ledger</p><h2 className="mt-1 text-xl font-black text-[#22304a]">Recent student contributions</h2></div><Clock3 className="h-7 w-7 text-[#d28738]"/></div><div className="mt-4 space-y-3">{activeLedger.map((entry) => <article id={`activity-${entry.id}`} key={entry.id} className="rounded-2xl border border-[#e4e9ef] bg-[#fbfcfe] p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-black text-[#22304a]">{studentName(entry.student)}</p><p className="mt-1 text-sm leading-5 text-[#617184]">{entry.reason}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-[#eef4fa] px-2.5 py-1 font-bold text-[#41607d]">{sourceLabel(entry.sourceType)}</span><span className="px-1 py-1 text-[#8994a2]">{entry.awardedAt.toLocaleString("en-GB")}</span></div></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-black ${entry.points >= 0 ? "bg-[#e9f7ee] text-[#2f7a4f]" : "bg-[#fff0f0] text-[#b34242]"}`}>{entry.points >= 0 ? "+" : ""}{entry.points}</span></div></article>)}{!activeLedger.length ? <p className="rounded-2xl bg-[#fbf6ef] p-5 text-sm text-[#617184]">No verified point activity for this Qabila yet.</p> : null}</div></section>

      <section className="rounded-[26px] border border-[#dce4ed] bg-white p-5 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#7a4bb5]">Badges & recognition</p><h2 className="mt-1 text-xl font-black text-[#22304a]">Recent awards</h2></div><div className="mt-4 space-y-3">{activeAwards.map((award) => <article id={`award-${award.id}`} key={award.id} className={`rounded-2xl border p-4 ${award.revokedAt ? "border-[#efcaca] bg-[#fff5f5]" : "border-[#ddd2ef] bg-[#faf7ff]"}`}><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eee5fb] text-[#7546ad]"><Award className="h-5 w-5"/></span><div><p className="font-black text-[#22304a]">{award.title}</p><p className="text-sm font-semibold text-[#5e6d80]">{studentName(award.student)}</p></div></div><p className="mt-3 text-sm leading-5 text-[#697789]">{award.evidence || award.description}</p><div className="mt-3 flex items-center justify-between text-[11px] text-[#8792a0]"><span>{award.sourceType === "AUTOMATIC" ? "Automatic" : "Teacher/Admin"}</span><span>{award.awardedAt.toLocaleDateString("en-GB")}</span></div></article>)}{!activeAwards.length ? <p className="rounded-2xl bg-[#faf7ff] p-5 text-sm text-[#617184]">No recognition recorded for this Qabila yet.</p> : null}</div></section>
    </div>

    <details className="rounded-[26px] border border-[#dce4ed] bg-white p-5"><summary className="flex cursor-pointer list-none items-center justify-between font-black text-[#22304a] [&::-webkit-details-marker]:hidden"><span>Reward governance & audit controls</span><ChevronDown className="h-5 w-5"/></summary><p className="mt-2 text-sm text-[#617184]">Administrative delivery and reversal tools are kept here to preserve a clear monitoring view.</p>
      <div className="mt-5 grid gap-5 xl:grid-cols-2"><section><h3 className="font-black text-[#22304a]">Unlocked Qabila rewards</h3><div className="mt-3 space-y-3">{unlocks.map((unlock) => <div key={unlock.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf6ef] p-4"><div><p className="font-bold">{unlock.title}</p><p className="text-xs text-[#617184]">{unlock.milestone} points · {unlock.claimedAt ? "Delivered" : "Awaiting delivery"}</p></div>{!unlock.claimedAt ? <form action={claim}><input type="hidden" name="unlockId" value={unlock.id}/><button className="rounded-full bg-[#2f6b4b] px-3 py-2 text-xs font-bold text-white">Mark delivered</button></form> : null}</div>)}</div></section>
      <section><h3 className="font-black text-[#22304a]">Recognition audit</h3><div className="mt-3 max-h-[520px] space-y-3 overflow-auto">{awards.map((award) => <div key={award.id} className="rounded-2xl border p-4"><p className="font-bold text-[#22304a]">{award.title} · {studentName(award.student)}</p><p className="mt-1 text-xs text-[#617184]">{award.student.houseMembership?.qabilaGroup || "No Qabila"} · {award.revokedAt ? "Revoked" : "Active"}</p>{!award.revokedAt ? <form action={revoke} className="mt-3"><input type="hidden" name="awardId" value={award.id}/><button className="rounded-full border border-[#efb3b3] px-3 py-1.5 text-xs font-bold text-[#b24646]">Revoke & reverse</button></form> : null}</div>)}</div></section></div>
    </details>
  </div></main>;
}