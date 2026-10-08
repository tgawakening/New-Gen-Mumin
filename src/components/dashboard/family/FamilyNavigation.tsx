'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useTransition, type ComponentProps, type ReactNode } from 'react';
const NavigationContext = createContext<((href: string, scroll?: boolean) => void) | null>(null);
export function FamilyNavigation({ children }: { children: ReactNode }) {
 const router = useRouter();
 const [pending, startTransition] = useTransition();
 const [visible, setVisible] = useState(false), [slow, setSlow] = useState(false);
 useEffect(() => {
  if (!pending) return;
  const show = setTimeout(() => setVisible(true), 400);
  const warn = setTimeout(() => setSlow(true), 12000);
  return () => { clearTimeout(show); clearTimeout(warn); setVisible(false); setSlow(false); };
 }, [pending]);
 return <NavigationContext.Provider value={(href, scroll) => startTransition(() => router.push(href, { scroll }))}>
  {children}
  {pending && visible && <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[60] pointer-events-none">
   <div className="h-1 overflow-hidden bg-amber-100"><div className="h-full w-1/3 animate-pulse bg-amber-500 motion-reduce:animate-none" /></div>
   <div className="mx-auto mt-2 w-fit max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-[#22304a] shadow-sm">{slow ? 'Still connecting. You can keep using this page or choose another section.' : 'Loading section...'}{slow && <button type="button" className="pointer-events-auto ml-3 underline" onClick={() => window.location.reload()}>Reload</button>}</div>
  </div>}
 </NavigationContext.Provider>;
}
export function FamilyPortalLink({ onNavigate, href, scroll, ...props }: ComponentProps<typeof Link>) {
 const navigate = useContext(NavigationContext);
 return <Link {...props} href={href} scroll={scroll} onNavigate={event => {
  onNavigate?.(event);
  if (navigate && typeof href === 'string' && /^\/(parent|student)(\/|\?|$)/.test(href)) { event.preventDefault(); navigate(href, scroll); }
 }} />;
}
