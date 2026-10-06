import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, ClipboardList, Download, Mail } from "lucide-react";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { feedbackMonth } from "@/lib/feedback/monthly-questions";
import { FamilyLogoutButton } from "@/components/dashboard/family/FamilyLogoutButton";
export default async function CommunicationsPage() {
 const session = await getCurrentSession();
 if (!session) redirect("/auth/login");
 const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true, status: true, firstName: true } });
 if (!user || user.status !== "ACTIVE") redirect("/auth/login");
 if (user.role !== "COMMUNICATIONS") redirect(getDashboardHome(user.role));
 const month = feedbackMonth();
 const [total, monthly, recent] = await Promise.all([
  db.monthlyParentFeedback.count(), db.monthlyParentFeedback.count({ where: { month } }),
  db.monthlyParentFeedback.findMany({ orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, month: true, details: true, version: true, updatedAt: true } }),
 ]);
 return <main className="min-h-screen bg-[#f7f2ea] pb-10 text-[#22304a]"><header className="bg-[#17243a] px-4 py-8 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-amber-200">Gen-Mumin | Communications Lead</p><h1 className="mt-3 text-2xl font-bold sm:text-3xl">Assalamu alaikum, {user.firstName}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">Your space to listen to families, follow up on feedback and help keep Gen-Mumin communications clear and connected.</p></div><FamilyLogoutButton /></div></header><div className="mx-auto max-w-6xl space-y-6 px-4 pt-6">
  <nav aria-label="Main navigation" className="flex flex-wrap gap-3 font-semibold"><Link href="/communications" className="rounded-full border bg-white px-4 py-2">Dashboard</Link><Link href="/communications/feedback" className="rounded-full bg-[#22304a] px-4 py-2 text-white">Monthly feedback</Link><Link href="/feedback/monthly" className="rounded-full border bg-white px-4 py-2">Family responses</Link></nav>
  <div className="grid gap-4 sm:grid-cols-3">{[["This month's responses", monthly], ["All monthly responses", total], ["Notifications", "Subscribed"]].map(([label, value]) => <section key={label} className="rounded-2xl border border-[#e5d6c5] bg-white p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></section>)}</div>
  <section className="rounded-3xl border border-[#e5d6c5] bg-white p-6"><div className="flex items-center gap-3"><MessageCircle className="text-amber-600" /><h2 className="text-xl font-bold">Listen to our families</h2></div><p className="mt-3 text-sm text-slate-600">Review answers by question, find a family and download a monthly spreadsheet. New submissions and updates are also sent to your email.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/feedback/monthly" className="inline-flex items-center gap-2 rounded-full bg-[#22304a] px-5 py-3 font-semibold text-white"><ClipboardList className="h-5 w-5" />Review monthly feedback</Link><a href={`/api/feedback/monthly?month=${month}`} className="inline-flex items-center gap-2 rounded-full border px-5 py-3 font-semibold"><Download className="h-5 w-5" />Download this month</a></div></section>
  <section className="rounded-3xl border border-[#e5d6c5] bg-white p-6"><h2 className="flex items-center gap-3 text-xl font-bold"><Mail className="h-5 w-5 text-amber-600" />Recent family feedback</h2><div className="mt-4 divide-y">{recent.map(r => { const d = r.details as Record<string,string>; return <Link key={r.id} href={`/feedback/monthly?month=${r.month}`} className="flex flex-wrap justify-between gap-2 py-4"><div><p className="font-semibold">{d.childName}</p><p className="text-sm text-slate-600">{d.parentName} | {r.month}</p></div><span className="text-sm text-slate-600">{r.version > 1 ? "Updated" : "Submitted"} {r.updatedAt.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span></Link>; })}{!recent.length && <p className="py-4 text-sm text-slate-600">Parent feedback will appear here as families submit it.</p>}</div></section>
 </div></main>;
}
