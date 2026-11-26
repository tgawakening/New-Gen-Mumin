import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdminFinance } from "@/lib/admin/access";
import { getPaymentsReport } from "@/lib/payments/report";
import { buildPaymentsReportWorkbook } from "@/lib/payments/report-workbook";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN" || !(await canAccessAdminFinance(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const report = await getPaymentsReport();
  const workbook = await buildPaymentsReportWorkbook(report);
  return new Response(new Uint8Array(workbook), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="gen-mumin-payments-report.xlsx"',
    "Cache-Control": "private, no-store",
  } });
}
