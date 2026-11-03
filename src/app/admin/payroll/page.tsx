import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { payrollAdmin } from "@/lib/payroll/service";
import { validMonth, type PayrollInput, type PayrollLine } from "@/lib/payroll/calculation";
import { emptyPayroll, STANDARD_RATES } from "@/lib/payroll/september-defaults";
import { MALIHA_PAYROLL_EMAIL, monthlyPayrollTemplate, payrollReference, referencePayroll } from "@/lib/payroll/october-defaults";
import { getTeacherHoursLogData } from "@/lib/teacher/hours-log";
import { PayrollEditor } from "@/components/payroll/PayrollEditor";
export const dynamic="force-dynamic";
export default async function AdminPayrollPage({searchParams}:{searchParams:Promise<{teacherId?:string;month?:string}>}) {
 try {await payrollAdmin();}catch{redirect("/admin");}
 const query=await searchParams;
 const now=new Date();const previousMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)).toISOString().slice(0,7);
 const month=query.month&&validMonth(query.month)?query.month:previousMonth;
 const teachers=await db.teacherProfile.findMany({where:{OR:[{isActive:true,user:{role:"TEACHER",status:"ACTIVE"}},{user:{email:MALIHA_PAYROLL_EMAIL,role:"COMMUNICATIONS",status:"ACTIVE"}}]},include:{user:true},orderBy:{user:{firstName:"asc"}}});
 const teacher=teachers.find(t=>t.id===query.teacherId);
 let content=null;
 if(teacher){
  const [slip,settings,hours]=await Promise.all([db.teacherPayslip.findUnique({where:{teacherId_month:{teacherId:teacher.id,month}}}),db.teacherPayrollSettings.findUnique({where:{teacherId:teacher.id}}),teacher.user.role==="TEACHER"?getTeacherHoursLogData(teacher.userId,month):Promise.resolve(null)]);
  const name=(teacher.user.firstName+" "+(teacher.user.lastName||"")).trim();
  const template=monthlyPayrollTemplate(month,teacher.user);
  const groups=new Map<string,PayrollLine>();
  for(const entry of hours?.entries??[]){
    const label=entry.programTitle||"Teaching sessions";
    const rate=/seerah|parental/i.test(label)?STANDARD_RATES.seerah:/life|leadership/i.test(label)?STANDARD_RATES.life:/arabic|tajweed/i.test(label)?STANDARD_RATES.arabic:"0";
    const line=groups.get(label)??{label,sessions:0,paidHours:"0",hourlyRate:rate,actualMinutes:0};
    line.sessions++;line.paidHours=String(line.sessions);line.actualMinutes+=entry.durationMinutes;groups.set(label,line);
  }
  const lines=month!=="2026-10"&&[...groups.values()].length?[...groups.values()]:[{label:"Teaching sessions",sessions:0,paidHours:"0",hourlyRate:"0",actualMinutes:0}];
  const reference=template?referencePayroll(month,template):undefined;
  const initial=slip?slip.draftData as unknown as PayrollInput:reference??emptyPayroll(lines);
  if(!slip&&month==="2026-10"&&!template)initial.sourceNote="No October reference is provided for this staff member. Sister Saba is excluded from the supplied October sheet. Enter approved figures only.";
  if(!slip&&settings)initial.showPkr=settings.showPkr;
  content=<PayrollEditor key={teacher.id+month} teacherId={teacher.id} teacherName={name} month={month} initial={initial} initialVersion={slip?.version??0} initialId={slip?.id} initialFolder={settings?.driveFolderId??""} reference={reference} portalMinutes={hours?.totals.totalMinutes??0} publishedAt={slip?.publishedAt?.toISOString()??null}/>;
 }
 return <main className="section-container space-y-6 py-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#c27a2c]">Gen-Mumin finance</p><h1 className="mt-2 text-3xl font-semibold text-[#22304a]">Teacher payroll</h1><p className="mt-2 text-sm text-[#617184]">Prepare, review and publish monthly paid payslips.</p></div><Link href="/admin" className="rounded-full border px-4 py-2 text-sm">Back to admin</Link></div>
 <form className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-[1fr_200px_auto]"><label className="text-sm">Teacher / staff member<select name="teacherId" defaultValue={teacher?.id??""} required className="mt-2 w-full rounded-xl border p-3"><option value="" disabled>Select a teacher</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}{t.user.role==="COMMUNICATIONS"?" (Communications)":""}</option>)}</select></label><label className="text-sm">Payroll month<input name="month" type="month" defaultValue={month} required className="mt-2 w-full rounded-xl border p-3"/></label><button className="self-end rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Open payslip</button></form>
 <div className="flex flex-wrap gap-3 text-sm"><Link href={{pathname:"/admin/payroll",query:{...(teacher?{teacherId:teacher.id}:{}),month:"2026-10"}}} className="rounded-full border bg-white px-4 py-2">October 2026 defaults</Link><Link href={{pathname:"/admin/payroll",query:{...(teacher?{teacherId:teacher.id}:{}),month:"2026-09"}}} className="rounded-full border bg-white px-4 py-2">September 2026 defaults</Link></div>
 {payrollReference(month)&&<p className="text-sm text-[#617184]">{payrollReference(month)!.label} defaults follow your payroll reference. <a href={payrollReference(month)!.source} target="_blank" rel="noreferrer" className="underline">View source spreadsheet</a>. Saved drafts are preserved until you choose to reload the reference.</p>}
 {content??<p className="rounded-2xl bg-[#f7f4eb] p-6">Choose a teacher to load their proposed sessions, hours and rates.</p>}
 </main>;
}
