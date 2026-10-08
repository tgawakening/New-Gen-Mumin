import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { AdminLoginModal } from '@/components/admin/AdminLoginModal';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { QABILA_NAMES, canonicalQabilaName } from '@/lib/community/qabilas';
import { getAdminQabilaMemberships } from '@/lib/admin/qabila-members';
const size = 30;
const field = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const date = (value: Date | null) => value ? value.toLocaleString('en-GB', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
const name = (s: {displayName: string | null; user: {firstName: string; lastName: string | null}}) => s.displayName || [s.user.firstName,s.user.lastName].filter(Boolean).join(' ');
function day(value?: string, next = false) {
 if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
 const parsed = new Date(value + 'T00:00:00+05:00');
 if (!Number.isFinite(+parsed) || new Date(+parsed + 5*3600000).toISOString().slice(0,10) !== value) return undefined;
 return new Date(+parsed + (next ? 86400000 : 0));
}
export default async function RewardsHistory({ searchParams }: {searchParams: Promise<Record<string,string | undefined>>}) {
 const session = await getCurrentSession();
 if (!session || session.user.role !== 'ADMIN') return <AdminLoginModal returnTo="/admin/rewards" />;
 const params = await searchParams;
 const qabila = canonicalQabilaName(params.qabila);
 const tab = ['points','recognition','rewards'].includes(params.tab || '') ? params.tab! : 'points';
 const basis = params.basis === 'recorded' ? 'recorded' : 'current';
 const search = (params.search || '').trim().slice(0,120);
 const from = day(params.from), to = day(params.to, true);
 const invalidRange = Boolean((params.from && !from) || (params.to && !to) || (from && to && from >= to));
 const awardedAt = invalidRange ? {lt:new Date(0)} : {...(from ? {gte:from}:{}),...(to ? {lt:to}:{})};
 const [memberships,houses] = await Promise.all([getAdminQabilaMemberships(),db.house.findMany({select:{id:true,name:true}})]);
 const members = memberships.filter(m => !qabila || canonicalQabilaName(m.qabilaGroup) === qabila);
 const studentIds = members.map(m => m.studentId);
 const houseIds = houses.filter(h => canonicalQabilaName(h.name) === qabila).map(h => h.id);
 const studentSearch: Prisma.StudentProfileWhereInput = {OR:[{displayName:{contains:search}},{user:{firstName:{contains:search}}},{user:{lastName:{contains:search}}}]};
 const pointWhere: Prisma.HousePointLedgerWhereInput = {awardedAt,...(qabila ? basis === 'recorded' ? {houseId:{in:houseIds}} : {studentId:{in:studentIds}} : {}),...(params.source ? {sourceType:params.source.slice(0,100)} : {}),...(search ? {OR:[{reason:{contains:search}},{student:studentSearch}]} : {})};
 const awardWhere: Prisma.RecognitionAwardWhereInput = {awardedAt,...(qabila?{studentId:{in:studentIds}}:{}),...(search?{OR:[{title:{contains:search}},{description:{contains:search}},{student:studentSearch}]}:{})};
 const rewardWhere: Prisma.HouseUnlockWhereInput = {createdAt:awardedAt,...(qabila?{houseId:{in:houseIds}}:{}),...(search?{title:{contains:search}}:{})};
 const total = tab === 'points' ? await db.housePointLedger.count({where:pointWhere}) : tab === 'recognition' ? await db.recognitionAward.count({where:awardWhere}) : await db.houseUnlock.count({where:rewardWhere});
 const pages = Math.max(1,Math.ceil(total/size));
 const page = Math.min(pages,Math.max(1,Math.floor(Number(params.page)||1)));
 const studentSelect = {displayName:true,user:{select:{firstName:true,lastName:true}},houseMembership:{select:{qabilaGroup:true}}} as const;
 const [points,awards,rewards,groups,sources] = await Promise.all([
  tab==='points'?db.housePointLedger.findMany({where:pointWhere,orderBy:[{awardedAt:'desc'},{id:'desc'}],skip:(page-1)*size,take:size,include:{student:{select:studentSelect},house:{select:{name:true}}}}):[],
  tab==='recognition'?db.recognitionAward.findMany({where:awardWhere,orderBy:[{awardedAt:'desc'},{id:'desc'}],skip:(page-1)*size,take:size,include:{student:{select:studentSelect}}}):[],
  tab==='rewards'?db.houseUnlock.findMany({where:rewardWhere,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*size,take:size,include:{house:{select:{name:true}}}}):[],
  tab==='points'?db.housePointLedger.groupBy({by:['sourceType'],where:pointWhere,_sum:{points:true},_count:{_all:true}}):[],
  db.housePointLedger.findMany({distinct:['sourceType'],select:{sourceType:true},orderBy:{sourceType:'asc'}}),
 ]);
 const issuerIds = [...new Set(awards.flatMap(a => [a.awardedByUserId,a.revokedByUserId].filter((id): id is string => Boolean(id))))];
 const issuers = issuerIds.length ? await db.user.findMany({where:{id:{in:issuerIds}},select:{id:true,firstName:true,lastName:true}}) : [];
 const issuer = (id: string | null) => !id ? 'Automatic / not recorded' : issuers.find(u=>u.id===id) ? name({displayName:null,user:issuers.find(u=>u.id===id)!}) : 'Former account ('+id+')';
 const url = (patch:Record<string,string>) => {const query=new URLSearchParams();for(const [key,value] of Object.entries({...params,...patch}))if(value)query.set(key,value);return '/admin/rewards/history?'+query;};
 return <main className="min-h-screen bg-[#edf2f6] px-4 py-6 text-[#22304a]"><div className="mx-auto max-w-7xl space-y-5"><header className="rounded-3xl bg-[#172842] p-6 text-white"><Link href="/admin/rewards" className="text-sm underline">Back to House &amp; Rewards</Link><h1 className="mt-3 text-3xl font-bold">Complete Qabila history</h1><p className="mt-2 text-sm">Review all stored points, badges and team rewards. All dates below use Pakistan time (PKT).</p></header>
 <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5"><input type="hidden" name="tab" value={tab}/><label className="grid gap-1 text-sm">Qabila<select name="qabila" defaultValue={qabila||''} className={field}><option value="">All Qabilas / all records</option>{QABILA_NAMES.map(q=><option key={q}>{q}</option>)}</select></label><label className="grid gap-1 text-sm">Point grouping<select name="basis" defaultValue={basis} className={field}><option value="current">Current members (dashboard totals)</option><option value="recorded">House recorded on each point entry</option></select></label><label className="grid gap-1 text-sm">From<input type="date" name="from" defaultValue={params.from} className={field}/></label><label className="grid gap-1 text-sm">To<input type="date" name="to" defaultValue={params.to} className={field}/></label>{tab==='points'&&<label className="grid gap-1 text-sm">Point source<select name="source" defaultValue={params.source||''} className={field}><option value="">All sources</option>{sources.map(s=><option key={s.sourceType} value={s.sourceType}>{s.sourceType.replaceAll('_',' ')}</option>)}</select></label>}<label className="grid gap-1 text-sm">Learner or description<input name="search" defaultValue={search} placeholder="Name or reason" maxLength={120} className={field}/></label><button className="rounded-xl bg-[#22304a] px-5 py-2 text-white">Apply filters</button><Link href="/admin/rewards/history" className="px-3 py-2 text-sm underline">Reset</Link></form>
 {invalidRange&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">Choose valid dates with the end date on or after the start date.</p>}
 <nav aria-label="History categories" className="flex flex-wrap gap-2">{[['points','Points ledger'],['recognition','Badges & recognition'],['rewards','Team reward unlocks']].map(([value,label])=><Link key={value} href={url({tab:value,page:'1',source:''})} aria-current={tab===value?'page':undefined} className={`rounded-xl px-4 py-3 font-semibold ${tab===value?'bg-[#22304a] text-white':'bg-white'}`}>{label}</Link>)}</nav>
 <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{tab==='points'?(basis==='current'?'Current-member grouping matches the dashboard: a learner\u2019s earlier points follow their current Qabila.':'Recorded-house grouping uses the house saved on each transaction, which can differ from the learner\u2019s current Qabila.'):tab==='recognition'?'Recognition is grouped by current membership; active and revoked awards are both included.':'Team rewards are grouped by the house saved on the reward. Date filters use the record creation date.'} Historical Qabila transfers were not stored as a separate audit trail; this view does not reconstruct missing transfers.</p>
 {tab==='points'&&<section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Filtered total: {groups.reduce((sum,g)=>sum+(g._sum.points||0),0).toLocaleString()} net points</h2><p className="mt-1 text-sm">{total.toLocaleString()} transactions across all matching pages, including deductions and corrections.</p><div className="mt-3 flex flex-wrap gap-2">{groups.map(g=><span key={g.sourceType} className="rounded-xl bg-slate-100 px-3 py-2 text-xs">{g.sourceType.replaceAll('_',' ')}: {g._sum.points||0} points / {g._count._all} entries</span>)}</div></section>}
 <section className="space-y-3" aria-label="History entries">{points.map(p=><article key={p.id} className="rounded-2xl bg-white p-5"><div className="flex justify-between gap-3"><div><h2 className="font-bold">{name(p.student)}</h2><p className="mt-1 whitespace-pre-wrap text-sm">{p.reason}</p></div><strong className={p.points<0?'text-red-700':'text-green-700'}>{p.points>0?'+':''}{p.points}</strong></div><p className="mt-3 text-xs text-slate-600">{date(p.awardedAt)} PKT · {p.sourceType.replaceAll('_',' ')} · Current Qabila: {canonicalQabilaName(p.student.houseMembership?.qabilaGroup)||'Unassigned'}</p><details className="mt-2 text-xs"><summary className="cursor-pointer">Audit references</summary><p className="mt-2 break-all">Recorded house: {p.house.name}<br/>Transaction: {p.id}<br/>Source reference: {p.sourceId||'Not recorded'}</p></details></article>)}
 {awards.map(a=><article key={a.id} className="rounded-2xl bg-white p-5"><h2 className="font-bold">{a.title} — {name(a.student)}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{a.description}</p><p className="mt-2 text-sm">{a.revokedAt?'Revoked':'Active'} · Bonus: {a.pointsBonus} points · Awarded: {date(a.awardedAt)} PKT</p><p className="mt-2 text-xs">Awarded by: {issuer(a.awardedByUserId)}{a.featuredWeek?` · Featured week: ${a.featuredWeek}`:''}</p>{a.revokedAt&&<p className="mt-2 text-xs text-red-700">Revoked: {date(a.revokedAt)} PKT · {issuer(a.revokedByUserId)}</p>}<details className="mt-2 text-xs"><summary>Evidence and references</summary><p className="mt-2 whitespace-pre-wrap break-all">{a.evidence||'No evidence recorded'}<br/>{a.sourceType} / {a.sourceId}<br/>Award: {a.id}</p></details></article>)}
 {rewards.map(r=><article key={r.id} className="rounded-2xl bg-white p-5"><h2 className="font-bold">{r.title} — {r.house.name}</h2><p className="mt-2 text-sm">{r.description}</p><p className="mt-2 text-sm">Milestone: {r.milestone} points · {r.claimedAt?'Delivered':r.unlockedAt?'Unlocked, awaiting delivery':'Not unlocked'}</p><p className="mt-2 text-xs">Created: {date(r.createdAt)} · Unlocked: {date(r.unlockedAt)} · Delivered: {date(r.claimedAt)} PKT</p><p className="mt-2 break-all text-xs">Reference: {r.id}</p></article>)}
 {!total&&<p className="rounded-2xl bg-white p-6">No records match these filters.</p>}</section>
 <nav aria-label="History pages" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4"><p className="text-sm">{total?`${(page-1)*size+1}–${Math.min(page*size,total)} of ${total.toLocaleString()}`:'0 entries'} · Page {page} of {pages}</p><div className="flex gap-4">{page>1&&<><Link href={url({page:'1'})}>First</Link><Link href={url({page:String(page-1)})}>Previous</Link></>}{page<pages&&<><Link href={url({page:String(page+1)})}>Next</Link><Link href={url({page:String(pages)})}>Last</Link></>}</div><form><input type="hidden" name="tab" value={tab}/>{Object.entries(params).filter(([key,value])=>key!=='page'&&key!=='tab'&&value).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}<label className="text-sm">Go to page <input aria-label="Page number" name="page" type="number" min="1" max={pages} defaultValue={page} className="w-20 rounded border p-2"/></label><button className="ml-2 rounded border px-3 py-2">Go</button></form></nav>
 <details className="rounded-2xl bg-white p-5"><summary className="cursor-pointer font-semibold">Current membership: {members.length} learners</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{members.map(m=><p className="text-sm" key={m.studentId}>{name(m.student)} · {canonicalQabilaName(m.qabilaGroup)||'Unassigned'} · {m.student.user.status}</p>)}</div></details>
 </div></main>;
}
