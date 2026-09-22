import { getCurrentSession } from "@/lib/auth/session";
import { learnerIdentity, loadQabilaCandidates, planQabilaDuplicates } from "@/lib/community/qabila-duplicates";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!session || session.user.role !== "ADMIN") {
    return Response.json({ error: "Admin access required." }, { status: session ? 403 : 401, headers });
  }
  const candidates = await loadQabilaCandidates();
  const relevant = candidates.filter((entry) => ["ahmad", "khadija", "muntaha"].includes(learnerIdentity(entry.student.displayName || [entry.student.user.firstName, entry.student.user.lastName].filter(Boolean).join(" "))));
  const ids = new Set(relevant.map((entry) => entry.studentId));
  const plans = planQabilaDuplicates(candidates).filter((plan) => ids.has(plan.keep.studentId) || plan.remove.some((entry) => ids.has(entry.studentId)));
  return Response.json({
    reportVersion: "qabila-order-links-v1",
    generatedAt: new Date().toISOString(),
    note: "Read-only report. No memberships were changed by this download.",
    plannedCorrections: plans.map((plan) => ({ keepStudentId: plan.keep.studentId, removeStudentIds: plan.remove.map((entry) => entry.studentId), qabila: plan.qabila })),
    learners: relevant,
  }, { headers: { ...headers, "Content-Disposition": 'attachment; filename="qabila-duplicate-order-links.json"' } });
}
