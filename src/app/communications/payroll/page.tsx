import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { publishedPayslips } from "@/lib/payroll/service";
import { monthLabel, validMonth, type PayrollSnapshot } from "@/lib/payroll/calculation";
import { PayslipCard } from "@/components/payroll/PayslipCard";
import { PayrollHistory } from "@/components/payroll/PayrollHistory";
export const dynamic = "force-dynamic";
export default async function CommunicationsPayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const query = await searchParams;
  const session = await getCurrentSession();
  const returnPath = query.month && validMonth(query.month) ? `/communications/payroll?month=${query.month}` : "/communications";
  if (!session) redirect(`/auth/login?next=${encodeURIComponent(returnPath)}`);
  if (session.user.role !== "COMMUNICATIONS") redirect(getDashboardHome(session.user.role));
  const slips = (await publishedPayslips(session.user.id, 120)).map(slip => ({ id: slip.id, month: slip.month, publishedAt: slip.publishedAt!.toISOString(), snapshot: slip.publishedData as unknown as PayrollSnapshot }));
  const selected = query.month && validMonth(query.month) ? slips.find(slip => slip.month === query.month) : slips[0];
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 text-[#22304a]"><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">My payslips</h1><p className="mt-1 text-sm text-[#617184]">Published monthly payments and optional payment evidence.</p></div><Link href="/communications" className="rounded-full border px-4 py-2">Back to dashboard</Link></header>
    {slips.length > 0 && <><p className="text-sm">Viewing {selected ? monthLabel(selected.month) : "requested month"}</p><PayrollHistory slips={slips}/></>}
    {selected ? <PayslipCard id={selected.id} snapshot={selected.snapshot}/> : <p className="rounded-2xl border bg-white p-6">Your payslip will appear after finance confirms payment and publishes it.</p>}
  </main>;
}
