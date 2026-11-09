import Link from "next/link";
import type { ReactNode } from "react";
import { FamilyLogoutButton } from "@/components/dashboard/family/FamilyLogoutButton";

export function CommunicationsCertificateFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode; navItems?: unknown }) {
  return <main className="min-h-screen bg-[#f7f2ea] text-[#22304a]">
    <header className="bg-[#17243a] px-4 py-8 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-amber-200">Gen-Mumin | Communications Lead</p><h1 className="mt-3 text-2xl font-bold sm:text-3xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">{subtitle}</p></div><FamilyLogoutButton /></div></header>
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6"><nav aria-label="Main navigation" className="flex flex-wrap gap-4 text-sm font-semibold"><Link href="/communications">Dashboard</Link><Link href="/communications/recognition">Child certificates</Link><Link href="/communications/parent-recognition">Mum certificates</Link><Link href="/communications/feedback">Monthly feedback</Link></nav><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Certificates you create display Sister Saba as the signatory.</p>{children}</div>
  </main>;
}
