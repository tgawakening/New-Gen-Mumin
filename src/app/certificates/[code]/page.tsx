import Image from "next/image";
import { Award, BookOpen, HandHeart, ShieldCheck, Sparkles, Star } from "lucide-react";
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
  const name = award.student.displayName || `${award.student.user.firstName} ${award.student.user.lastName ?? ""}`.trim();
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName ?? ""}`.trim() : "Gen-Mumin Faculty";
  const qabila = qabilaProfile(award.student.houseMembership?.qabilaGroup);
  const gender = award.student.registrationStudents[0]?.gender?.toLowerCase() ?? "";
  const character = gender.includes("girl") || gender.includes("female") ? "/gen-mumin-chars/girl-certificate-v2.png" : gender.includes("boy") || gender.includes("male") ? "/gen-mumin-chars/boy-certificate-v2.png" : null;
  const weekly = Boolean(award.featuredWeek);
  return <main className="min-h-screen bg-[#eef2f7] p-3 sm:p-6 print:bg-white print:p-0">
    <style>{`@page { size: A4 landscape; margin: 8mm; } @media print { body { background: white !important; } }`}</style>
    <div data-certificate-artwork className="relative mx-auto aspect-[1.414/1] w-full max-w-[980px] overflow-hidden border-[10px] border-[#10294a] bg-[#fffaf0] shadow-2xl print:h-[190mm] print:w-[277mm] print:max-w-none print:shadow-none">
      <div className="pointer-events-none absolute inset-2 border-2 border-[#d99a2b]"/><div className="pointer-events-none absolute inset-5 border border-[#e5bd6f]"/><div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#fff0cb] to-transparent"/><div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#eeb95d]/20"/><div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#6ea98a]/20"/>
      <div className="relative flex h-full flex-col items-center px-8 py-9 text-center sm:px-16 sm:py-12">
        <div className="flex w-full items-center justify-between gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#e4b153] bg-[#17375d] text-[#ffd274] shadow-lg sm:h-20 sm:w-20"><HandHeart className="h-7 w-7 sm:h-10 sm:w-10"/></span><div><p className="text-[10px] font-black uppercase tracking-[0.36em] text-[#c27a2c] sm:text-sm">Generation Mumin</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6a7685] sm:text-xs">Character • Service • Leadership</p></div><span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#e4b153] bg-gradient-to-br from-[#ffca55] to-[#d96f18] text-white shadow-lg sm:h-20 sm:w-20"><Star className="h-7 w-7 fill-current sm:h-10 sm:w-10"/></span></div>
        <div className="mt-3 flex items-center gap-3 sm:mt-5"><span className="h-px w-14 bg-[#d6a044] sm:w-28"/><Sparkles className="h-5 w-5 text-[#d08b25]"/><span className="h-px w-14 bg-[#d6a044] sm:w-28"/></div>
        <h1 className="mt-3 font-serif text-2xl font-black uppercase tracking-[0.08em] text-[#173153] sm:text-5xl">{weekly ? "Mumin of the Week" : "Certificate of Character"}</h1><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#7b8490] sm:text-sm">Proudly presented to</p><h2 className="mt-1 border-b-2 border-[#d5a24a] px-8 pb-2 font-serif text-3xl font-black text-[#132b4b] sm:text-6xl">{name}</h2>
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center gap-5 sm:mt-6 sm:gap-10">{character ? <div className="relative hidden h-44 w-36 overflow-hidden rounded-[32px] border-4 border-[#efc876] bg-[#fff3d4] shadow-lg sm:block"><Image src={character} alt="Gen-Mumin learner character" fill className="object-contain object-bottom"/></div> : null}<div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full bg-[#eaf6ee] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#2d7650] sm:text-sm"><ShieldCheck className="h-4 w-4"/>{weekly ? award.title : `For earning ${award.title}`}</div><p className="mt-4 font-serif text-base font-semibold leading-6 text-[#4c596a] sm:text-2xl sm:leading-9">“{award.evidence}”</p>{qabila ? <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] sm:text-sm" style={{ color: qabila.color }}>{qabila.name}</p> : null}</div></div>
        <div className="mt-4 grid w-full grid-cols-3 items-end gap-4 border-t border-[#dfc18b] pt-4 text-[9px] text-[#657184] sm:text-xs"><div className="text-left"><p className="font-black text-[#263b58]">{new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(award.awardedAt)}</p><p className="mt-1">Date awarded</p></div><div><Award className="mx-auto h-7 w-7 text-[#d18a25] sm:h-9 sm:w-9"/><p className="mt-1 font-bold">Certificate {award.certificateCode.slice(-8).toUpperCase()}</p></div><div className="text-right"><p className="font-serif text-sm font-black text-[#263b58] sm:text-lg">{teacherName}</p><p className="mt-1">Gen-Mumin teacher</p></div></div><div className="mt-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#8a6a35] sm:text-xs"><BookOpen className="h-3.5 w-3.5"/>Points celebrate progress. Character is the goal.</div>
      </div>
    </div><CertificateActions filename={`${name} ${weekly ? "Mumin of the Week" : award.title}`}/>
  </main>;
}