import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { FamilyDashboardFrame } from "@/components/dashboard/family/FamilyDashboardFrame";
import { MonthlyParentForm } from "@/components/dashboard/feedback/MonthlyParentForm";
import { feedbackMonth, validMonth, type Answers } from "@/lib/feedback/monthly-questions";
export default async function ParentFeedbackPage({ searchParams }: { searchParams?: Promise<{ child?: string; month?: string }> }) {
 const session = await getCurrentSession();
 if (!session) redirect("/auth/login");
 if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));
 const params = await searchParams;
 const parent = await db.parentProfile.findUnique({ where: { userId: session.user.id }, include: { user: true, students: { include: { student: { include: { user: true, enrollments: { include: { program: true } }, houseMembership: { include: { house: true } } } } } } } });
 if (!parent) redirect("/registration");
 const children = parent.students.map(({ student: s }) => ({ id: s.id, name: s.displayName || `${s.user.firstName} ${s.user.lastName}`.trim(), age: s.dateOfBirth ? ageAt(s.dateOfBirth) : s.age ? String(s.age) : "", country: s.countryName || parent.billingCountryName || "", timezone: parent.user.timezone || s.user.timezone || "", programmes: [...new Set(s.enrollments.map(e => e.program.title))].join(", "), qabila: s.houseMembership?.house.name || "" }));
 const selected = children.find(c => c.id === params?.child) ?? children[0];
 const month = params?.month && validMonth(params.month) ? params.month : feedbackMonth();
 const [saved, legacy] = await Promise.all([
  db.monthlyParentFeedback.findMany({ where: { studentId: { in: children.map(c => c.id) } }, orderBy: { submittedAt: "desc" }, select: { id: true, version: true, submittedById: true, details: true, studentId: true, month: true, submittedAt: true, answers: true } }),
  db.weeklyFeedbackResponse.findMany({ where: { audience: "PARENT", submittedById: session.user.id }, orderBy: { submittedAt: "desc" }, take: 12 }),
 ]);
 return <FamilyDashboardFrame roleLabel="Parent portal" title="Monthly family feedback" subtitle="A few small reflections help us support your child. Arabic learning, personal growth and community, in three easy steps." navItems={getParentNavItems(selected?.id)}>
  <MonthlyParentForm key={`${month}:${selected?.id}`} learners={children} parentName={`${parent.user.firstName} ${parent.user.lastName}`.trim()} initialChild={selected?.id ?? ""} month={feedbackMonth()} initialMonth={month} saved={saved.map(s => ({ ...s, submittedAt: s.submittedAt.toISOString(), answers: s.answers as Answers, details: s.details as Record<"parentName" | "childName" | "age" | "country" | "timezone", string>, canManage: s.submittedById === session.user.id }))} />
  {saved.length > 0 && <details className="mt-5 rounded-2xl bg-white p-5"><summary className="cursor-pointer font-semibold">Your monthly feedback history ({saved.length})</summary><ul className="mt-3 space-y-2">{saved.map(s => <li key={s.studentId + s.month}><a className="text-blue-800 underline" href={`/parent/feedback?child=${s.studentId}&month=${s.month}`}>{children.find(c => c.id === s.studentId)?.name} - {s.month}</a></li>)}</ul></details>}
  {legacy.length > 0 && <details className="mt-5 rounded-2xl bg-white p-5"><summary className="cursor-pointer font-semibold">Earlier weekly feedback</summary>{legacy.map(s => <div key={s.id} className="mt-4 border-t pt-3"><p className="font-semibold">{s.weekLabel}</p><p>{s.wins}</p><p>{s.concerns}</p><p>{s.supportNeeded}</p></div>)}</details>}
 </FamilyDashboardFrame>;
}

function ageAt(birth: Date) {
 const now = new Date();
 let age = now.getUTCFullYear() - birth.getUTCFullYear();
 if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
 return age > 0 && age < 100 ? String(age) : "";
}
