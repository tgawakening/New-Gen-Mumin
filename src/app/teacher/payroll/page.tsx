import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { PayslipCard } from "@/components/payroll/PayslipCard";
import { publishedPayslips } from "@/lib/payroll/service";
import { monthLabel, validMonth, type PayrollSnapshot } from "@/lib/payroll/calculation";
export const dynamic="force-dynamic";
export default async function TeacherPayrollPage({searchParams}:{searchParams:Promise<{month?:string}>}) {
 const session=await getCurrentSession();if(!session)redirect("/auth/login");if(session.user.role!=="TEACHER")redirect(getDashboardHome(session.user.role));
 const query=await searchParams;
 const slips=await publishedPayslips(session.user.id,120);
 const selected=query.month&&validMonth(query.month)?query.month:slips[0]?.month;
 const slip=slips.find(s=>s.month===selected);
 return <TeacherDashboardFrame title="My payslips" subtitle="Your monthly payment summary, teaching hours and payment evidence." navItems={getTeacherNavItems()}>
 <div className="space-y-5">{slips.length>0&&<form className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4"><label className="text-sm">Payroll month<select name="month" defaultValue={selected} className="ml-3 rounded-lg border px-3 py-2">{slips.map(s=><option key={s.id} value={s.month}>{monthLabel(s.month)}</option>)}</select></label><button className="rounded-full bg-[#22304a] px-4 py-2 text-sm text-white">View payslip</button></form>}{slip?<PayslipCard id={slip.id} snapshot={slip.publishedData as unknown as PayrollSnapshot}/>:<p className="rounded-2xl border bg-white p-6">Your payslip will appear here once admin confirms payment and publishes it.</p>}</div>
 </TeacherDashboardFrame>;
}
