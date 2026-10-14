import Link from "next/link";
import { EarnedBadgeArtwork, type EarnedBadgeProps } from "./EarnedBadgeArtwork";
export function AdminBadgePreview({ code, ...props }: EarnedBadgeProps & {code:string}) {
  return <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-[#22304a]">Preview & download PNG</summary><div className="mx-auto mt-4 max-w-sm"><EarnedBadgeArtwork {...props}/></div><Link href={"/badges/"+code} className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-3 text-sm font-semibold text-white">Edit name / download PNG</Link></details>;
}
