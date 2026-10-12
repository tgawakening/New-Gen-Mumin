import { RecognitionCertificate } from "@/components/dashboard/RecognitionCertificate";
import { recognitionWeekLabel } from "@/lib/community/recognition-week";
import { notFound, redirect } from "next/navigation";
import { CertificateActions } from "@/components/dashboard/CertificateActions";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
type Props={params:Promise<{code:string}>};
export default async function ParentCertificatePage({params}:Props){const session=await getCurrentSession();if(!session)redirect("/auth/login");const {code}=await params;const award=await db.parentRecognitionAward.findUnique({where:{certificateCode:code},include:{parent:{include:{user:true}}}});if(!award||!award.isPublic||award.revokedAt)notFound();if(!["ADMIN","TEACHER"].includes(session.user.role)&&award.parent.userId!==session.user.id)notFound();const teacher=await db.user.findUnique({where:{id:award.awardedByUserId},select:{firstName:true,lastName:true}});const name=award.recipientName||`${award.parent.user.firstName} ${award.parent.user.lastName??""}`.trim();const teacherName=teacher?`${teacher.firstName} ${teacher.lastName??""}`.trim():"Gen-Mumin Faculty";return <main className="min-h-screen bg-[#f0ecee] px-3 py-6 sm:p-8 print:bg-white print:p-0"><div className="overflow-x-auto" data-certificate-preview><RecognitionCertificate kind="mum" name={name} title="Mum of the Week" recognition={award.title} evidence={award.evidence} week={award.featuredWeek ? recognitionWeekLabel(award.featuredWeek) : undefined} date={new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Karachi" }).format(award.awardedAt)} teacher={teacherName} code={award.certificateCode} /></div><CertificateActions filename={name + " Mum of the Week"}/></main>;
}
