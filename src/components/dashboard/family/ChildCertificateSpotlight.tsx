import Image from "next/image";
import Link from "next/link";
import { Award, ArrowRight, Sparkles } from "lucide-react";

type AwardPreview = { certificateCode: string; title: string; evidence: string | null };

function avatarForGender(gender?: string | null) {
  const value = gender?.trim().toLowerCase() ?? "";
  if (["female", "girl", "f"].includes(value)) return { src: "/gen-mumin-chars/girl-certificate-v2.png", alt: "Gen-Mumin girl celebrating her award" };
  if (["male", "boy", "m"].includes(value)) return { src: "/gen-mumin-chars/boy-certificate-v2.png", alt: "Gen-Mumin boy celebrating his award" };
  return null;
}

export function ChildCertificateSpotlight({ award, childName, childId, gender, parentView = false }: { award: AwardPreview; childName: string; childId: string; gender?: string | null; parentView?: boolean }) {
  const avatar = avatarForGender(gender);
  const href = parentView ? `/parent/rewards?child=${encodeURIComponent(childId)}#weekly-certificate` : "/student/rewards#weekly-certificate";
  return <section className="relative overflow-hidden rounded-[26px] border border-[#e7bd6f] bg-[linear-gradient(115deg,#102b4d_0%,#173f6c_55%,#fff8e8_55%,#fffdf8_100%)] shadow-[0_14px_35px_rgba(22,45,75,.16)]">
    <div className="grid min-h-[170px] md:grid-cols-[1.1fr_.9fr]">
      <div className="relative z-10 p-5 text-white sm:p-6"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#ffd474]"><Sparkles className="h-4 w-4"/>Wonderful news</p><h2 className="mt-2 text-2xl font-black">Congratulations, {childName}!</h2><p className="mt-2 text-sm leading-6 text-white/80">You have been awarded <strong className="text-white">{award.title}</strong>. Your character and effort have been recognised.</p><Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ffbd51] px-5 py-2.5 text-sm font-black text-[#102b4d]">See your award <ArrowRight className="h-4 w-4"/></Link></div>
      <div className="relative min-h-[150px] overflow-hidden p-5 text-center"><div className="absolute inset-3 rounded-[20px] border border-[#e7bd6f] bg-white/88"/><Award className="absolute right-5 top-5 h-10 w-10 text-[#d98624]"/><div className="relative z-10 max-w-[65%] pt-3"><p className="font-serif text-xs font-bold uppercase tracking-[.16em] text-[#8f642f]">Certificate awarded</p><p className="mt-3 text-xl font-black text-[#132b4b]">{award.title}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#637083]">{award.evidence || "A teacher has recognised this learner for excellent character and effort."}</p></div>{avatar ? <Image src={avatar.src} alt={avatar.alt} width={150} height={190} className="absolute -bottom-8 right-2 z-10 h-[165px] w-[125px] object-contain"/> : null}</div>
    </div>
  </section>;
}