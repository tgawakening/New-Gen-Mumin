import Link from "next/link";
import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProgramEligibleRosterStudents } from "@/lib/live-classes/service";
import { attendanceDayKey } from "@/lib/live-classes/attendance-policy";
import { AdminAttendanceRecovery } from "@/components/admin/AdminAttendanceRecovery";
import { AdminAttendanceOverview } from "@/components/admin/AdminAttendanceOverview";
export default async function Page({ searchParams }: { searchParams?: Promise<{ search?: string; page?: string; student?: string }> }){
 const params = await searchParams ?? {};
 const session=await getCurrentSession();if(session?.user.role!=="ADMIN")return <AdminLoginModal returnTo="/admin/attendance"/>;
 const programs=await db.program.findMany({select:{id:true}});
 const names=new Map<string,{id:string;name:string;parents:string;teachers:string[]}>();
 for(const program of programs)for(const student of await getProgramEligibleRosterStudents(program.id,false)){
  names.set(student.id,{id:student.id,name:student.displayName||`${student.user.firstName} ${student.user.lastName??''}`.trim(),parents:student.parents.map(({parent})=>`${parent.user.firstName} ${parent.user.lastName??''}`.trim()).join(', '),teachers:[]});
 }
 const rosters=await db.teacherStudentRoster.findMany({where:{studentId:{in:[...names.keys()]}},select:{studentId:true,teacher:{select:{user:{select:{firstName:true,lastName:true}}}}}});
 for(const roster of rosters){const student=names.get(roster.studentId);const name=`${roster.teacher.user.firstName} ${roster.teacher.user.lastName??''}`.trim();if(student&&!student.teachers.includes(name))student.teachers.push(name);}
 const reports=await db.adminAttendanceRecovery.findMany({orderBy:{updatedAt:'desc'},take:50,include:{student:{select:{displayName:true}}}});
 return <div className="mx-auto max-w-6xl space-y-6 p-6"><Link href="/admin" className="underline">Back to admin dashboard</Link><h1 className="text-3xl font-bold">Attendance recovery</h1><p>Record parent-reported attendance for previous months. August is selected by default; adjust the dates as needed.</p><AdminAttendanceOverview learners={[...names.values()].sort((a,b)=>a.name.localeCompare(b.name))} {...params}/><AdminAttendanceRecovery learners={[...names.values()].sort((a,b)=>a.name.localeCompare(b.name))} today={attendanceDayKey(new Date())}/><section className="space-y-3"><h2 className="text-xl font-bold">Recent recovery reports</h2>{reports.map(report=><details key={report.id} className="rounded border bg-white p-3"><summary>{report.student.displayName} - {report.fromDay} to {report.toDay} - {report.parentName}</summary><p>{report.note}</p><p>{report.missedCount} missed with unknown dates. To revise, preview this learner using the same date range.</p><ul className="mt-2 space-y-2 text-sm">{(Array.isArray(report.revisions)?report.revisions:[]).map((value,index)=>{const entry=value as { savedAt?: string; parentName?: string; mode?: string; missedCount?: number; pointsDelta?: number; programme?: string; note?: string };return <li key={index} className="rounded bg-slate-50 p-2">Saved {entry.savedAt ? new Date(entry.savedAt).toLocaleString("en-GB",{timeZone:"Asia/Karachi"}) : ""} PKT | {entry.parentName} | {entry.mode==="all"?"Attended all":entry.mode==="count"?`${entry.missedCount} missed; dates unknown`:"Specific absences recorded"} | Programme: {entry.programme || "Any programme"} | Points adjustment: {entry.pointsDelta}<p>{entry.note}</p></li>;})}</ul></details>)}</section></div>;
}
