import Link from "next/link";
import { db } from "@/lib/db";
import { BadgeEmblem } from "@/components/badges/BadgeEmblem";
import { EarnedBadgeArtwork } from "@/components/badges/EarnedBadgeArtwork";

export type RosterAwardFilters = { awardPage?: string; rosterPage?: string; awardStudent?: string; awardKind?: string; award?: string; tab?: string };
const pageNumber = (value?: string) => /^\d+$/.test(value ?? "") ? Math.max(1, Math.min(100000, Number(value))) : 1;

export async function RosterAwards({ students, filters }: { students: Array<{ id: string; name: string }>; filters: RosterAwardFilters }) {
  const ids = students.map(({ id }) => id);
  const selected = students.find(({ id }) => id === filters.awardStudent);
  const kind = filters.awardKind === "badge" || filters.awardKind === "certificate" ? filters.awardKind : "all";
  const active = { isPublic: true, revokedAt: null } as const;
  const where = { ...active, studentId: { in: selected ? [selected.id] : ids }, ...(kind === "certificate" ? { badgeKey: "MUMIN_OF_WEEK" } : kind === "badge" ? { badgeKey: { not: "MUMIN_OF_WEEK" } } : {}), ...(filters.award ? { id: filters.award } : {}) };
  const [count, grouped] = await Promise.all([
    db.recognitionAward.count({ where }),
    ids.length ? db.recognitionAward.groupBy({ by: ["studentId", "badgeKey"], where: { ...active, studentId: { in: ids } }, _count: { _all: true } }) : [],
  ]);
  const pages = Math.max(1, Math.ceil(count / 10));
  const page = Math.min(pageNumber(filters.awardPage), pages);
  const rosterPages = Math.max(1, Math.ceil(students.length / 10));
  const rosterPage = Math.min(pageNumber(filters.rosterPage), rosterPages);
  const awards = ids.length ? await db.recognitionAward.findMany({ where, orderBy: [{ awardedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 10, take: 10, include: { student: { include: { user: true, houseMembership: true } } } }) : [];
  function href(changes: Record<string, string | null>) {
    const params = new URLSearchParams();
    for (const key of ["awardPage", "rosterPage", "awardStudent", "awardKind", "award", "tab"] as const) if (filters[key]) params.set(key, filters[key]!);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return `/teacher/recognition?${params}#roster-awards`;
  }
  const date = (value: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(value);
  return <section id="roster-awards" className="scroll-mt-24 space-y-5 rounded-3xl border border-[#eadfce] bg-white p-5 sm:p-6">
    <div><p className="text-xs font-bold uppercase tracking-widest text-[#aa6822]">Celebrate your students</p><h2 className="mt-2 text-2xl font-bold text-[#22304a]">Roster badges & certificates</h2><p className="mt-2 text-sm leading-6 text-[#617184]">Automatic badges and awards from any teacher appear here. Discuss the achievement in class and encourage the effort behind it.</p></div>
    <details className="rounded-2xl border border-[#eadfce] p-4" open><summary className="cursor-pointer font-bold text-[#22304a]">Your students ({students.length})</summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">{students.slice((rosterPage - 1) * 10, rosterPage * 10).map((student) => {
        const totals = grouped.filter((row) => row.studentId === student.id);
        const certificates = totals.filter((row) => row.badgeKey === "MUMIN_OF_WEEK").reduce((sum, row) => sum + row._count._all, 0);
        const badges = totals.filter((row) => row.badgeKey !== "MUMIN_OF_WEEK").reduce((sum, row) => sum + row._count._all, 0);
        return <li key={student.id}><Link href={href({ awardStudent: student.id, awardPage: null, award: null })} className={`block min-h-11 rounded-xl border p-3 text-sm ${selected?.id === student.id ? "border-[#d5af5b] bg-[#fff8e8]" : "border-[#e4e9ed] bg-[#f8fafc]"}`}><span className="font-bold text-[#22304a]">{student.name}</span><span className="mt-1 block text-xs text-[#617184]">{badges} badges · {certificates} certificates · View achievements</span></Link></li>;
      })}</ul>
      {!students.length ? <p className="mt-3 text-sm text-[#617184]">No students are currently in your roster.</p> : null}
      <nav aria-label="Roster pages" className="mt-3 flex flex-wrap items-center gap-3 text-sm">{rosterPage > 1 ? <Link className="min-h-11 content-center underline" href={href({ rosterPage: String(rosterPage - 1) })}>Previous students</Link> : null}<span>Page {rosterPage} of {rosterPages}</span>{rosterPage < rosterPages ? <Link className="min-h-11 content-center underline" href={href({ rosterPage: String(rosterPage + 1) })}>Next students</Link> : null}</nav>
    </details>
    <form action="/teacher/recognition#roster-awards" className="flex flex-wrap items-end gap-3">
      {filters.tab ? <input type="hidden" name="tab" value={filters.tab} /> : null}
      <label className="grid max-w-full gap-1 text-sm font-semibold text-[#22304a]">Student<select name="awardStudent" defaultValue={selected?.id ?? ""} className="max-w-full rounded-xl border border-[#dce4ed] bg-white p-3"><option value="">All roster students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold text-[#22304a]">Award type<select name="awardKind" defaultValue={kind} className="rounded-xl border border-[#dce4ed] bg-white p-3"><option value="all">All achievements</option><option value="badge">Badges</option><option value="certificate">Weekly certificates</option></select></label>
      <button className="min-h-11 rounded-full bg-[#22304a] px-5 py-3 text-sm font-bold text-white">Show achievements</button>
      {(selected || filters.award || kind !== "all") ? <Link href={href({ awardStudent: null, award: null, awardKind: null, awardPage: null })} className="min-h-11 content-center text-sm underline">Clear filters</Link> : null}
    </form>
    <p className="text-sm text-[#617184]">{count} achievements{selected ? ` for ${selected.name}` : " across your roster"}</p>
    <div className="grid gap-3">{awards.map((award) => {
      const name = award.student.displayName || `${award.student.user.firstName} ${award.student.user.lastName ?? ""}`.trim();
      const certificate = award.badgeKey === "MUMIN_OF_WEEK";
      return <article key={award.id} className="rounded-2xl border border-[#eadfce] bg-[#fffcf5] p-4"><div className="flex items-start gap-3"><BadgeEmblem badgeKey={award.badgeKey} title={award.title} /><div className="min-w-0 flex-1"><h3 className="font-bold text-[#22304a]">{name}</h3><p className="mt-1 font-semibold text-[#946219]">{award.title}</p><p className="mt-2 break-words text-sm leading-6 text-[#617184]">{award.evidence}</p><p className="mt-2 text-xs text-[#617184]">{date(award.awardedAt)} · {award.sourceType === "AUTOMATIC" ? "Earned automatically" : "Teacher / team award"}{award.pointsBonus ? ` · +${award.pointsBonus} points` : ""}</p><div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-[#24466e]">{!certificate ? <Link className="min-h-11 content-center underline" href={`/badges/${award.certificateCode}`}>View / download badge</Link> : null}{certificate ? <Link className="min-h-11 content-center underline" href={`/certificates/${award.certificateCode}`}>Open certificate</Link> : null}</div></div></div>{!certificate ? <details className="mt-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-[#24466e]">Preview badge artwork</summary><div className="mx-auto mt-3 max-w-sm"><EarnedBadgeArtwork name={award.recipientName || name} title={award.title} badgeKey={award.badgeKey} reason={award.evidence || award.description} qabila={award.student.houseMembership?.qabilaGroup} date={date(award.awardedAt)} /></div></details> : null}</article>;
    })}</div>
    {!awards.length ? <p className="rounded-2xl bg-[#f8fafc] p-5 text-sm text-[#617184]">No achievements match this view yet.</p> : null}
    <nav aria-label="Achievement pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">{page > 1 ? <Link className="min-h-11 content-center underline" href={href({ awardPage: String(page - 1) })}>Previous awards</Link> : <span />}<span>Page {page} of {pages} · 10 per page</span>{page < pages ? <Link className="min-h-11 content-center underline" href={href({ awardPage: String(page + 1) })}>Next awards</Link> : <span />}</nav>
  </section>;
}
