import { getCurrentSession } from "@/lib/auth/session";
import { getAdminQabilaMemberships, groupQabilaMembers, qabilaMembersCsv } from "@/lib/admin/qabila-members";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return Response.json({ error: "Admin access required." }, { status: session ? 403 : 401, headers: { "Cache-Control": "private, no-store" } });
  }
  const groups = groupQabilaMembers(await getAdminQabilaMemberships());
  return new Response(qabilaMembersCsv(groups), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gen-mumin-qabila-members.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
