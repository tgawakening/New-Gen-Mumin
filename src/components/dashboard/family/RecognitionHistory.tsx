import Link from "next/link";
import { recognitionWeekLabel } from "@/lib/community/recognition-week";

type Award = { id: string; title: string; certificateCode: string; featuredWeek: string | null; awardedAt: Date; evidence: string | null };
export function RecognitionHistory({ awards, parent = false }: { awards: Award[]; parent?: boolean }) {
 if (!awards.length) return null;
 return <details className="rounded-2xl border border-[#eadfce] bg-white p-5"><summary className="cursor-pointer font-semibold text-[#22304a]">{parent ? "Mum recognition history" : "Recognition history"} ({awards.length})</summary><p className="mt-2 text-sm text-[#617184]">Previous awards stay here after their featured week ends.</p><ul className="mt-4 space-y-3">{awards.map(award => <li key={award.id} className="rounded-xl border border-[#eadfce] p-4"><p className="font-semibold text-[#22304a]">{award.title}</p><p className="mt-1 text-xs text-[#617184]">{award.featuredWeek ? recognitionWeekLabel(award.featuredWeek) : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(award.awardedAt)}</p>{award.evidence && <p className="mt-2 text-sm text-[#617184]">{award.evidence}</p>}<Link href={(parent ? "/parent-certificates/" : "/certificates/") + award.certificateCode} className="mt-3 inline-block text-sm font-semibold text-[#0f4d81] underline">View certificate</Link></li>)}</ul></details>;
}
