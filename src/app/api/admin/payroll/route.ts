import { after, NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deliverPayrollEmails } from "@/lib/payroll/email-worker";
import { payrollAdmin, savePayroll } from "@/lib/payroll/service";
export async function POST(request: NextRequest) {
 try {
  await payrollAdmin();
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  if (!origin || new URL(origin).host !== host || request.headers.get("sec-fetch-site")==="cross-site") return NextResponse.json({error:"Unauthorized request"},{status:403});
  if (Number(request.headers.get("content-length") || 0) > 9*1024*1024) return NextResponse.json({error:"Upload must be under 8 MB."},{status:413});
  const result = await savePayroll(await request.formData());
  if (result.published) after(async () => { try { await deliverPayrollEmails(10,result.id); } catch (error) { console.error("[teacher-payroll] Email remains queued",error); } });
  revalidatePath("/admin/payroll"); revalidatePath("/teacher"); revalidatePath("/teacher/payroll");
  return NextResponse.json(result);
 } catch(error) {
  console.error("[teacher-payroll] Save failed",error);
  const message = error instanceof Error ? error.message : "Unable to save payslip.";
  const safe = /prisma|database|Google.*failed|constraint|connect|sql/i.test(message) ? "The payslip could not be saved. Check database and Drive setup, then try again." : message;
  return NextResponse.json({error:safe},{status:/access required/.test(message)?403:400});
 }
}
