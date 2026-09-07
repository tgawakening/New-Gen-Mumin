import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { FardhTrackerBoard } from "@/components/community/FardhTrackerBoard";
import { ChildSelector, FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { db } from "@/lib/db";
import { ensureFardhLaunchEmail, ensureFardhReminder, getFardhWeek, saveFardhDay, type FardhPrayerKey } from "@/lib/community/fardh-tracker";

type Props={searchParams?:Promise<{child?:string;week?:string;saved?:string;points?:string}>};
export default async function ParentFardhTrackerPage({searchParams}:Props){
 const session=await getCurrentSession(); if(!session) redirect('/auth/login'); if(session.user.role!=='PARENT') redirect(getDashboardHome(session.user.role));
 const dashboard=await getParentDashboardData(session.user.id); if(!dashboard?.children.length) redirect('/registration'); const params=searchParams?await searchParams:{}; const child=dashboard.children.find(c=>c.id===params.child)??dashboard.children[0]; const timezone=child.profile.timezone||'Europe/London';
 await ensureFardhReminder(session.user.id,`/parent/fardh-tracker?child=${child.id}`,timezone); await ensureFardhLaunchEmail({toEmail:session.user.email,recipientName:session.user.firstName,trackerPath:`/parent/fardh-tracker?child=${child.id}`}); const week=await getFardhWeek(child.id,params.week,timezone);
 async function save(formData:FormData){'use server'; const current=await getCurrentSession(); if(!current||current.user.role!=='PARENT') redirect('/auth/login'); const parent=await db.parentProfile.findUnique({where:{userId:current.user.id}}); const childId=String(formData.get('childId')||''); if(!parent||!await db.parentStudent.findUnique({where:{parentId_studentId:{parentId:parent.id,studentId:childId}}})) throw new Error('Learner is not linked to this parent.'); const tz=String(formData.get('timezone')||'Europe/London'); const result=await saveFardhDay({studentId:childId,dayKey:String(formData.get('dayKey')||''),timezone:tz,prayers:formData.getAll('prayer').map(String) as FardhPrayerKey[]}); revalidatePath('/parent/fardh-tracker'); revalidatePath('/student/fardh-tracker'); redirect(`/parent/fardh-tracker?child=${childId}&saved=1&points=${result.points}`); }
 const action=async(formData:FormData)=>{'use server'; formData.set('childId',child.id); formData.set('timezone',timezone); await save(formData)};
 return <FamilyDashboardFrame roleLabel="Parent-supervised student view" title="Fardh Prayer Tracker" subtitle="Record each daily salah honestly, see the weekly rhythm, and celebrate consistent worship." navItems={getParentNavItems(child.id)} pendingReason={dashboard.pendingReason}><ActionToast message={params.saved?`Prayer tracker saved. ${params.points||0} new points awarded—never duplicated.`:undefined}/><SectionCard eyebrow="Learner" title="Choose a learner"><ChildSelector learners={dashboard.children.map(c=>({id:c.id,name:c.name}))} selectedChildId={child.id} basePath="/parent/fardh-tracker"/></SectionCard><input type="hidden"/><FardhTrackerBoard {...week} action={action} locked={child.accessLocked} queryPrefix={`child=${child.id}&`}/></FamilyDashboardFrame>
}