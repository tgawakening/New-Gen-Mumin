import Link from "next/link";
import { Award, Sparkles } from "lucide-react";

export function TeacherRewardWorkspaceTabs({ active }: { active: "points" | "recognition" }) {
  const tabs = [
    { key: "points" as const, label: "Live House Points", description: "Award observed class actions", href: "/teacher/house-points", icon: Sparkles },
    { key: "recognition" as const, label: "Badges & Recognition", description: "Award character with evidence", href: "/teacher/recognition", icon: Award },
  ];
  return <nav aria-label="Live points and recognition tools" className="mb-6 grid gap-3 rounded-[24px] border border-[#dce4ed] bg-white p-3 shadow-sm sm:grid-cols-2">
    {tabs.map((tab) => { const Icon = tab.icon; const selected = active === tab.key; return <Link key={tab.key} href={tab.href} aria-current={selected ? "page" : undefined} className={`flex min-h-20 items-center gap-3 rounded-[18px] border px-4 py-3 transition ${selected ? "border-[#e7a94f] bg-[#172b49] text-white shadow-md" : "border-[#dce4ed] bg-[#f8fafc] text-[#22304a] hover:border-[#e7a94f] hover:bg-[#fff8ec]"}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${selected ? "bg-[#f4b85f] text-[#172b49]" : "bg-[#fff0d9] text-[#b66b1f]"}`}><Icon className="h-5 w-5"/></span><span><strong className="block">{tab.label}</strong><span className={`mt-1 block text-xs ${selected ? "text-white/70" : "text-[#617184]"}`}>{tab.description}</span></span></Link>; })}
  </nav>;
}