import { RecognitionCertificate } from "@/components/dashboard/RecognitionCertificate";
import { recognitionWeekLabel } from "@/lib/community/recognition-week";
import { notFound, redirect } from "next/navigation";
import { CertificateActions } from "@/components/dashboard/CertificateActions";
import { getCurrentSession } from "@/lib/auth/session";
import { qabilaProfile } from "@/lib/community/qabilas";
import { db } from "@/lib/db";
type Props = { params: Promise<{ code: string }> };
export default async function CertificatePage({ params }: Props) {
  const session = await getCurrentSession(); if (!session) redirect("/auth/login");
  const { code } = await params;
  const award = await db.recognitionAward.findUnique({ where: { certificateCode: code }, include: { student: { include: { user: true, parents: { include: { parent: true } }, houseMembership: true, registrationStudents: { orderBy: { createdAt: "desc" }, take: 1, select: { gender: true } } } } } });
  if (!award || !award.isPublic || award.revokedAt) notFound();
  const allowed = session.user.role === "ADMIN" || session.user.role === "TEACHER" || award.student.userId === session.user.id || award.student.parents.some((link) => link.parent.userId === session.user.id); if (!allowed) notFound();
  const teacher = award.awardedByUserId ? await db.user.findUnique({ where: { id: award.awardedByUserId }, select: { firstName: true, lastName: true } }) : null;
  const name = award.recipientName?.trim() || award.student.displayName || `${award.student.user.firstName} ${award.student.user.lastName ?? ""}`.trim();
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName ?? ""}`.trim() : "Gen-Mumin Faculty";
  const qabila = qabilaProfile(award.student.houseMembership?.qabilaGroup);
  const gender = award.student.registrationStudents[0]?.gender?.trim().toLowerCase() ?? "";
  const girl = ["girl", "female", "f"].includes(gender);
  const boy = ["boy", "male", "m"].includes(gender);
  const kind = girl ? "girl" : boy ? "boy" : qabila?.gender === "GIRLS" ? "girl" : qabila?.gender === "BOYS" ? "boy" : "neutral";
  const weekly = Boolean(award.featuredWeek) || award.badgeKey === "MUMIN_OF_WEEK";
  const weeklyTitle = kind === "girl" ? "Mumina of the Week" : "Mumin of the Week";
  const title = weekly ? weeklyTitle : "Certificate of Character";
  const recognition = award.badgeKey === "MUMIN_OF_WEEK" || ["Mumin of the Week", "Mumina of the Week"].includes(award.title) ? weeklyTitle : award.title;
  return <main className="min-h-screen bg-[#edf1f3] px-3 py-6 sm:p-8 print:bg-white print:p-0"><div className="overflow-x-auto" data-certificate-preview><RecognitionCertificate kind={kind} name={name} title={title} recognition={recognition} evidence={award.evidence ?? award.description ?? "In recognition of your effort, growth and beautiful character."} week={award.featuredWeek ? recognitionWeekLabel(award.featuredWeek) : undefined} date={new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Karachi" }).format(award.awardedAt)} teacher={teacherName} code={award.certificateCode} qabila={qabila?.name} /></div><CertificateActions filename={name + " " + (weekly ? weeklyTitle : award.title)}/></main>;
}
