"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, CalendarDays, CheckCircle2, Menu, X } from "lucide-react";
import { FamilyNavLinkClient } from "@/components/dashboard/family/FamilyNavLinkClient";
import type { FamilyNavIcon } from "@/lib/dashboard/family-nav";
import type { NavActivity } from "@/lib/notifications/navigation";
type NavItem = { label: string; href: string; icon?: FamilyNavIcon; activity?: NavActivity };
export function MobileFamilyNavRailClient({ navItems }: { navItems: NavItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const home = navItems[0];
  const classes = navItems.find(item => item.href.split('?')[0].endsWith('/schedule'));
  const sunnah = navItems.find(item => item.label === 'Sunnah Tracker');
  const primary = [home, classes, sunnah].filter((item): item is NavItem => Boolean(item));
  const more = navItems.filter(item => !primary.includes(item));
  const otherActivity = more.reduce((total,item)=>total+(item.activity?.count??0),0);
  const shortcuts = [{item:home,label:'Home',Icon:Home},{item:classes,label:'Classes',Icon:CalendarDays},{item:sunnah,label:'Sunnah',Icon:CheckCircle2}];
  return <>
    <div className="mt-4 hidden items-center gap-2 sm:flex"><nav className="flex flex-wrap gap-2" aria-label="Main dashboard sections">{primary.map(item=><FamilyNavLinkClient key={item.href} {...item} variant="mobileTab"/>)}</nav><button type="button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded} aria-controls="family-all-sections" className="min-h-12 rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold">{expanded?'Close menu':'More'}{otherActivity?` (${otherActivity})`:''}</button></div>
    {expanded?<section id="family-all-sections" aria-label="All sections" className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 max-h-[65dvh] overflow-y-auto rounded-t-3xl border border-white/20 bg-[#17243a] p-4 text-white shadow-xl sm:static sm:mt-3 sm:rounded-2xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">What would you like to do?</h2><button type="button" onClick={()=>setExpanded(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center"><X aria-hidden="true"/></button></div><nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="More dashboard sections" onClick={event=>{if((event.target as HTMLElement).closest('a'))setExpanded(false);}}>{more.map(item=><FamilyNavLinkClient key={item.href} {...item} variant="mobileTab"/>)}</nav></section>:null}
    <nav aria-label="Quick access" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#e6ded3] bg-white px-2 pt-1 text-[#22304a] shadow-lg sm:hidden" style={{paddingBottom:'max(0.5rem, env(safe-area-inset-bottom))'}}>
      {shortcuts.map(({item,label,Icon})=>item?<Link prefetch={false} key={label} href={item.href} onClick={()=>setExpanded(false)} aria-current={pathname===item.href.split('?')[0]?'page':undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${pathname===item.href.split('?')[0]?'bg-[#fff0db] text-[#875013]':''}`}><Icon className="h-5 w-5" aria-hidden="true"/>{label}</Link>:null)}
      <button type="button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded} aria-controls="family-all-sections" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold"><Menu className="h-5 w-5" aria-hidden="true"/>More{otherActivity?' •':''}</button>
    </nav>
  </>;
}
