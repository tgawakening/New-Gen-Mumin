import "server-only";

import Image from "next/image";
import { Sparkles, TrendingUp, Trophy, Users } from "lucide-react";

import { canonicalQabilaName, QABILA_NAMES, qabilaProfile } from "@/lib/community/qabilas";
import { db } from "@/lib/db";

const weekMs = 7 * 24 * 60 * 60 * 1000;

function contributionLabel(sourceType: string, reason: string) {
  if (sourceType.startsWith("SUNNAH")) return "Sunnah tracker progress";
  if (sourceType.startsWith("FARDH")) return "Daily Salah progress";
  if (sourceType.includes("ATTENDANCE")) return "On-time attendance";
  if (sourceType.includes("HOMEWORK")) return "Learning work completed";
  if (sourceType.includes("QUIZ")) return "Quiz contribution";
  if (sourceType.includes("RECOGNITION") || sourceType.includes("CROSS_HOUSE")) return "Character recognition";
  return reason || "Verified contribution";
}

export async function QabilaLeaderboardOverview({ audience }: { audience: "parent" | "teacher" }) {
  const since = new Date(Date.now() - weekMs);
  const [totals, memberships, recent] = await Promise.all([
    db.housePointLedger.groupBy({ by: ["studentId"], _sum: { points: true } }),
    db.houseMembership.findMany({ where: { qabilaGroup: { not: null } }, select: { studentId: true, qabilaGroup: true } }),
    db.housePointLedger.findMany({ where: { points: { gt: 0 } }, orderBy: { awardedAt: "desc" }, take: 160, select: { studentId: true, points: true, reason: true, sourceType: true, awardedAt: true, student: { select: { displayName: true, user: { select: { firstName: true } }, houseMembership: { select: { qabilaGroup: true } } } } } }),
  ]);
  const qabilaByStudent = new Map(memberships.map((row) => [row.studentId, canonicalQabilaName(row.qabilaGroup)]));
  const scores = new Map(QABILA_NAMES.map((name) => [name, 0]));
  for (const row of totals) { const name = qabilaByStudent.get(row.studentId); if (name) scores.set(name, (scores.get(name) ?? 0) + (row._sum.points ?? 0)); }
  const rows = QABILA_NAMES.map((name) => {
    const activity = recent.filter((item) => canonicalQabilaName(item.student.houseMembership?.qabilaGroup) === name);
    const unique = [...new Map(activity.map((item) => [item.studentId, item])).values()].slice(0, 2);
    return { name, profile: qabilaProfile(name)!, points: scores.get(name) ?? 0, weekly: activity.filter((item) => item.awardedAt >= since).reduce((sum, item) => sum + item.points, 0), members: memberships.filter((item) => canonicalQabilaName(item.qabilaGroup) === name).length, activity: unique };
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((row) => row.points));
  return <section className="overflow-hidden rounded-[30px] border border-[#d7e1eb] bg-white shadow-[0_18px_50px_rgba(25,48,77,.1)]">
    <header className="bg-[radial-gradient(circle_at_88%_20%,rgba(255,199,101,.23),transparent_28%),linear-gradient(125deg,#10294a,#1e527d)] px-5 py-5 text-white sm:px-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#ffd073]"><Trophy className="h-4 w-4"/>Healthy Qabila competition</p><h2 className="mt-2 text-2xl font-black">Live Qabila leaderboard</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/75">Every verified act of learning, consistency and service strengthens the whole Qabila.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs leading-5 text-white/80">{audience === "teacher" ? "Celebrate progress and encourage every learner fairly." : "Encourage your child to contribute with sincerity—not to chase points alone."}</div></div></header>
    <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-4">{rows.map((row,index)=><article key={row.name} className="relative overflow-hidden rounded-[24px] border border-[#dfe6ed] bg-[#fbfcfe] p-4"><div className="absolute right-3 top-3 text-4xl font-black text-[#d7dee7]">#{index+1}</div><div className="flex items-center gap-3"><Image src={row.profile.image} alt={row.name} width={54} height={54} className="h-14 w-14 rounded-2xl object-cover shadow-sm"/><div className="min-w-0 pr-8"><h3 className="truncate font-black text-[#1c304d]">{row.name}</h3><p className="text-xs text-[#6d7a8b]">{row.profile.mentor}</p></div></div><div className="mt-4 flex items-end justify-between"><div><p className="text-3xl font-black tabular-nums text-[#142b4a]">{row.points}</p><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#7a8797]">total points</p></div><span className="rounded-full bg-[#eaf7ef] px-3 py-1.5 text-xs font-black text-[#2d7650]"><TrendingUp className="mr-1 inline h-3.5 w-3.5"/>+{row.weekly} this week</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7edf3]"><div className="h-full rounded-full" style={{width:`${Math.max(4,(row.points/max)*100)}%`,backgroundColor:row.profile.color}}/></div><div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#5e6c7e]"><Users className="h-4 w-4"/>{row.members} learners</div><div className="mt-3 space-y-2 border-t border-[#e6ebf0] pt-3">{row.activity.map((item)=><div key={`${item.studentId}-${item.awardedAt.toISOString()}`} className="flex items-start justify-between gap-2 text-xs"><div className="min-w-0"><p className="truncate font-bold text-[#2c405b]">{item.student.displayName || item.student.user.firstName}</p><p className="truncate text-[#788596]">{contributionLabel(item.sourceType,item.reason)}</p></div><span className="shrink-0 font-black text-[#2d7650]">+{item.points}</span></div>)}{!row.activity.length?<p className="text-xs text-[#8a95a3]">New verified activity will appear here.</p>:null}</div></article>)}</div>
    <footer className="flex items-center justify-center gap-2 border-t border-[#e3e9ef] bg-[#fffaf2] px-5 py-3 text-center text-xs font-bold text-[#6c604f]"><Sparkles className="h-4 w-4 text-[#c37a27]"/>We compete in good deeds, support one another, and grow together.</footer>
  </section>;
}