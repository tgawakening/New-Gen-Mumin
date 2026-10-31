import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { EarnedBadgeArtwork } from "@/components/badges/EarnedBadgeArtwork";
import { BadgeDownload } from "@/components/badges/BadgeDownload";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";

export default async function BadgePage({ params, searchParams }: { params: Promise<{code:string}>; searchParams: Promise<{saved?:string;error?:string}> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  const { code } = await params;
  const status = await searchParams;
  const award = await db.recognitionAward.findUnique({ where: { certificateCode: code }, include: { student: { include: { user: true, parents: { include: { parent: true } }, houseMembership: true, registrationStudents: { orderBy: { createdAt: "desc" }, take: 1, select: { gender: true } } } } } });
  if (!award || !award.isPublic || award.revokedAt) notFound();
  if (award.badgeKey === "MUMIN_OF_WEEK") redirect(`/certificates/${code}`);
  const admin = session.user.role === "ADMIN";
  if (!admin && session.user.role !== "TEACHER" && award.student.userId !== session.user.id && !award.student.parents.some(link => link.parent.userId === session.user.id)) notFound();
  const name = award.recipientName || award.student.displayName || [award.student.user.firstName, award.student.user.lastName].filter(Boolean).join(" ");
  async function saveName(form: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "ADMIN") notFound();
    const recipientName = String(form.get("recipientName") ?? "").trim().replace(/\s+/g," ");
    if (recipientName.length > 80) redirect("/badges/" + code + "?error=name");
    const result = await db.recognitionAward.updateMany({ where: { certificateCode: code, isPublic: true, revokedAt: null }, data: { recipientName: recipientName || null } });
    if (!result.count) notFound();
    for (const path of ["/badges/" + code, "/admin/rewards", "/admin/rewards/history", "/parent/rewards", "/student/rewards"]) revalidatePath(path);
    redirect("/badges/" + code + "?saved=1");
  }
  return <main className="min-h-screen bg-[#edf2f6] px-4 py-6"><div className="mx-auto max-w-2xl space-y-5">
    <Link href={admin ? "/admin/rewards/history?tab=recognition" : session.user.role === "PARENT" ? "/parent/rewards?child=" + award.studentId : session.user.role === "TEACHER" ? "/teacher/recognition" : "/student/rewards"} className="text-sm font-semibold text-[#22304a] underline">Back to badges & rewards</Link>
    <div><h1 className="text-2xl font-bold text-[#22304a]">Celebrate an earned badge</h1><p className="mt-2 text-sm text-slate-600">Download this badge to share with your Qabila or community.</p></div>
    <EarnedBadgeArtwork name={name} title={award.title} badgeKey={award.badgeKey} reason={award.evidence || award.description} qabila={award.student.houseMembership?.qabilaGroup} gender={award.student.registrationStudents[0]?.gender} date={new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"Asia/Karachi"}).format(award.awardedAt)}/>
    <BadgeDownload filename={name + " " + award.title}/>
    {admin && <form action={saveName} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><label htmlFor="badge-name" className="block font-semibold text-[#22304a]">Name displayed on this badge</label><input id="badge-name" name="recipientName" maxLength={80} defaultValue={award.recipientName || ""} placeholder={name} className="w-full rounded-xl border border-slate-300 p-3"/><p className="text-xs text-slate-600">Leave blank to use the student profile name. Saved changes appear on this badge in the family portal too.</p><FormSubmitButton pendingLabel="Saving name..." className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">Save badge name</FormSubmitButton>{status.saved && <p role="status" className="text-sm text-green-800">Badge name saved. You can download the updated PNG.</p>}{status.error && <p role="alert" className="text-sm text-red-700">Please use a name of 80 characters or fewer.</p>}</form>}
    <Link href={"/certificates/" + code} className="block text-center text-sm text-slate-600 underline">View full certificate</Link>
  </div></main>;
}
