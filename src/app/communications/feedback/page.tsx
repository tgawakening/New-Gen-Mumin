import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MonthlyParentForm, type SavedFeedback } from "@/components/dashboard/feedback/MonthlyParentForm";
import { feedbackMonth } from "@/lib/feedback/monthly-questions";
export default async function DemoFeedbackPage() {
 const session = await getCurrentSession();
 if (!session) redirect("/auth/login");
 const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true, status: true, firstName: true } });
 if (!user || user.status !== "ACTIVE") redirect("/auth/login");
 if (user.role !== "COMMUNICATIONS") redirect(getDashboardHome(user.role));
 const saved = await db.monthlyFeedbackDemo.findMany({ where: { userId: session.user.id }, orderBy: { month: "desc" } });
 const month = feedbackMonth();
 return <main className="min-h-screen bg-[#f7f2ea] px-4 py-6 text-[#22304a]"><div className="mx-auto max-w-5xl space-y-4"><nav aria-label="Main navigation" className="flex flex-wrap gap-4 text-sm font-semibold"><Link href="/communications">Dashboard</Link><Link aria-current="page" href="/communications/feedback">Monthly feedback</Link><Link href="/feedback/monthly">Family responses</Link></nav><h1 className="text-2xl font-bold">Monthly feedback - test form</h1><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Try the complete parent form using sample details. Your submission is saved as a dummy entry here; it does not count as family feedback or send notification emails.</p><MonthlyParentForm demo learners={[{ id: "demo", name: "Sample child", age: "9", country: "Pakistan", timezone: "Asia/Karachi", programmes: "Test: Arabic, Seerah and life skills", qabila: "" }]} parentName={user.firstName} initialChild="demo" month={month} initialMonth={month} saved={saved.map(s => ({ id: s.id, version: s.version, studentId: "demo", month: s.month, submittedAt: s.submittedAt.toISOString(), details: s.details as SavedFeedback["details"], answers: s.answers as SavedFeedback["answers"], canManage: true }))} /></div></main>;
}
