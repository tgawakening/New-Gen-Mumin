import "server-only";

import Image from "next/image";
import { Sparkles, TrendingUp, Trophy, Users } from "lucide-react";

import { canonicalQabilaName, QABILA_NAMES, qabilaProfile } from "@/lib/community/qabilas";
import { readContributionEvents } from "@/lib/community/qabila-history";
import { QabilaContributionExplorer } from "./QabilaContributionExplorer";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const weekMs = 7 * 24 * 60 * 60 * 1000;

async function renderQabilaLeaderboard({ audience }: { audience: "parent" | "teacher" }) {
  // Server-rendered live leaderboard: this moving seven-day window is intentionally request-time data.
  const asOf = new Date();
  const since = new Date(asOf.getTime() - weekMs);
  const session = await getCurrentSession();
  const [totals, weeklyTotals, memberships, children, supervised] = await Promise.all([
    db.housePointLedger.groupBy({ by: ["studentId"], where: { awardedAt: { lte: asOf } }, _sum: { points: true } }),
    db.housePointLedger.groupBy({ by: ["studentId"], where: { awardedAt: { gte: since, lte: asOf } }, _sum: { points: true } }),
    db.houseMembership.findMany({ where: { qabilaGroup: { not: null } }, select: { studentId: true, qabilaGroup: true, student: { select: { displayName: true, user: { select: { firstName: true, lastName: true } } } } } }),
    session?.user.role === "PARENT" ? db.parentStudent.findMany({ where: { parent: { userId: session.user.id } }, select: { studentId: true } }) : Promise.resolve([]),
    session?.user.role === "TEACHER" ? db.communityRoomSupervisor.findMany({ where: { userId: session.user.id }, select: { room: { select: { title: true } } } }) : Promise.resolve([]),
  ]);
  const ownQabilas = new Set([
    ...memberships.filter(m => children.some(child => child.studentId === m.studentId)).map(m => canonicalQabilaName(m.qabilaGroup)),
    ...supervised.map(item => canonicalQabilaName(item.room.title)),
  ].filter(Boolean));
  const qabilaByStudent = new Map(memberships.map((row) => [row.studentId, canonicalQabilaName(row.qabilaGroup)]));
  const scores = new Map(QABILA_NAMES.map((name) => [name, 0]));
  for (const row of totals) { const name = qabilaByStudent.get(row.studentId); if (name) scores.set(name, (scores.get(name) ?? 0) + (row._sum.points ?? 0)); }
  const weeklyScores = new Map(QABILA_NAMES.map(name => [name, 0]));
  for (const row of weeklyTotals) { const name = qabilaByStudent.get(row.studentId); if (name) weeklyScores.set(name, (weeklyScores.get(name) ?? 0) + (row._sum.points ?? 0)); }
  const rows = (await Promise.all(QABILA_NAMES.map(async (name) => {
    const members = memberships.filter(item => canonicalQabilaName(item.qabilaGroup) === name);
    const activity = await readContributionEvents(members.map(m => ({ id: m.studentId, name: m.student.displayName || `${m.student.user.firstName} ${m.student.user.lastName ?? ""}`.trim() })), asOf, 3);
    return { name, profile: qabilaProfile(name)!, points: scores.get(name) ?? 0, weekly: weeklyScores.get(name) ?? 0, members: members.length, activity, highlighted: ownQabilas.has(name) };
  }))).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((row) => row.points));
  return <section className="overflow-hidden rounded-[30px] border border-[#d7e1eb] bg-white shadow-[0_18px_50px_rgba(25,48,77,.1)]">
    <header className="bg-[radial-gradient(circle_at_88%_20%,rgba(255,199,101,.23),transparent_28%),linear-gradient(125deg,#10294a,#1e527d)] px-5 py-5 text-white sm:px-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#ffd073]"><Trophy className="h-4 w-4"/>Healthy Qabila competition</p><h2 className="mt-2 text-2xl font-black">Live Qabila leaderboard</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/75">Every verified act of learning, consistency and service strengthens the whole Qabila.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs leading-5 text-white/80">{audience === "teacher" ? "Celebrate progress and encourage every learner fairly." : "Encourage your child to contribute with sincerity—not to chase points alone."}</div></div></header>
    <div className="space-y-3 p-4 sm:p-5">{rows.map((row,index)=><article key={row.name} className={`relative overflow-hidden rounded-[24px] border p-4 transition-shadow hover:shadow-md sm:p-5 ${index===0?"border-[#e0b45f] bg-gradient-to-r from-[#fffaf0] to-[#fbfcfe]":"border-[#dfe6ed] bg-[#fbfcfe]"}`}>
      <div className="grid items-center gap-4 md:grid-cols-[minmax(240px,1.05fr)_minmax(210px,.75fr)_minmax(280px,1.2fr)]">
        <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-4"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl ${index===0?"bg-[#f1b94f] text-[#142b4a]":"bg-[#e7edf3] text-[#53667d]"}`}>#{index+1}</span><Image src={row.profile.image} alt={row.name} width={62} height={62} className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-sm sm:h-16 sm:w-16 sm:rounded-2xl"/><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#a46626]">Qabila</p><h3 className="mt-0.5 break-words text-base font-black leading-tight text-[#1c304d] sm:text-lg">{row.name.replace(/^Qabila\s+/i, "")}</h3>{index===0?<span className="mt-2 inline-flex rounded-full bg-[#fff0c7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.1em] text-[#94600d]">Leading</span>:null}<p className="mt-1 text-xs text-[#6d7a8b]">{row.profile.mentor}</p><p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#5e6c7e]"><Users className="h-3.5 w-3.5"/>{row.members} learners</p></div></div>
        <div><div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-black tabular-nums text-[#142b4a]">{row.points}</p><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#7a8797]">total points</p></div><span className="shrink-0 rounded-full bg-[#eaf7ef] px-3 py-1.5 text-xs font-black text-[#2d7650]"><TrendingUp className="mr-1 inline h-3.5 w-3.5"/>{row.weekly > 0 ? "+" : ""}{row.weekly}</span></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e7edf3]"><div className="h-full rounded-full transition-[width] duration-500" style={{width:`${Math.max(4,(row.points/max)*100)}%`,backgroundColor:row.profile.color}}/></div><p className="mt-1 text-right text-[10px] text-[#8490a0]">7-day growth</p></div>
        <QabilaContributionExplorer qabila={row.name} highlighted={row.highlighted} preview={row.activity} />
      </div>
    </article>)}</div>    <footer className="flex items-center justify-center gap-2 border-t border-[#e3e9ef] bg-[#fffaf2] px-5 py-3 text-center text-xs font-bold text-[#6c604f]"><Sparkles className="h-4 w-4 text-[#c37a27]"/>We compete in good deeds, support one another, and grow together.</footer>
  </section>;
}
export async function QabilaLeaderboardOverview(props: { audience: "parent" | "teacher" }) {
  try {
    return await renderQabilaLeaderboard(props);
  } catch (error) {
    console.error("Qabila leaderboard unavailable", error);
    return <section role="status" className="rounded-2xl border border-[#d7e1eb] bg-white p-5"><h2 className="font-bold text-[#22304a]">Qabila leaderboard temporarily unavailable</h2><p className="mt-2 text-sm text-[#617184]">Your dashboard and class links are still available. Please refresh to reload the leaderboard.</p></section>;
  }
}
