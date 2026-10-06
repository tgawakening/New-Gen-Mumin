import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canReviewMonthlyFeedback } from "@/lib/feedback/monthly";
import { feedbackMonth, validMonth, type Answers } from "@/lib/feedback/monthly-questions";
import { MonthlyFeedbackReview } from "@/components/dashboard/feedback/MonthlyFeedbackReview";
export default async function MonthlyReviewPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
 const params = await searchParams;
 const month = params?.month && validMonth(params.month) ? params.month : feedbackMonth();
 const session = await getCurrentSession();
 if (!session) redirect("/auth/login?next=" + encodeURIComponent("/feedback/monthly?month=" + month));
 if (!(await canReviewMonthlyFeedback(session.user.id))) redirect(getDashboardHome(session.user.role));

 const responses = await db.monthlyParentFeedback.findMany({ where: { month }, orderBy: { submittedAt: "desc" }, include: { submittedBy: { select: { email: true } } } });
 return <main className="min-h-screen bg-[#f7f2ea] px-4 py-8 text-[#22304a]"><div className="mx-auto max-w-6xl space-y-6"><header className="rounded-3xl border bg-white p-6"><Link className="text-sm underline" href={getDashboardHome(session.user.role)}>Back to my dashboard</Link><h1 className="mt-4 text-2xl font-bold">Monthly parent feedback</h1><p className="mt-2 text-sm text-slate-600">Review every answer by question or by family. Access is limited to administrators, Sir Mehran and Sister Saba.</p><div className="mt-5 flex flex-wrap items-end gap-4"><form className="flex items-end gap-3"><label className="grid gap-2 text-sm font-semibold">Month<input name="month" type="month" min="2020-01" max={feedbackMonth()} defaultValue={month} required className="rounded-xl border p-3" /></label><button className="rounded-full bg-[#22304a] px-5 py-3 text-white">Show responses</button></form><a className="rounded-full border px-5 py-3 font-semibold" href={`/api/feedback/monthly?month=${month}`}>Download monthly spreadsheet (CSV)</a></div><p className="mt-3 text-xs text-slate-500">The download includes all responses for {month}, one child per row with each question in its own column.</p></header><MonthlyFeedbackReview responses={responses.map(r => ({ id: r.id, month: r.month, submittedAt: r.submittedAt.toISOString(), parentEmail: r.submittedBy.email, details: r.details as Record<string,string>, answers: r.answers as Answers }))} /></div></main>;
}
