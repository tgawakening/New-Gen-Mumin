"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, ChevronDown, ArrowRight, Plus, Minus, X, Mail, Phone } from "lucide-react";
import { PROGRAMS, PROGRAMS_LABEL, NAV, SITE } from "@/lib/config";
import { SOCIAL_LINKS } from "@/components/TopBar";

/** Header nav: Home | Gen-Mumins Programs | Pricing | Faq's | Contact | Enroll Now (live structure). */
export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);

  const isHome = pathname === "/";

  return (
    <header className="bg-[#FDF6EF] sticky top-0 z-50">
      <nav className="section-container" aria-label="Global">
        <div className="flex items-center justify-between py-3 md:py-4">
          <Link href="/" className="flex-shrink-0" aria-label="Gen-Mumins Home">
            <Logo logoUrl={SITE.logoUrl || undefined} />
          </Link>

          <button
            type="button"
            className="xl:hidden -m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Nav links + Enroll Now - right aligned (live: header-right) */}
          <div className="hidden xl:flex xl:items-center xl:justify-end xl:gap-8 xl:ml-auto">
            <Link
              href="/"
              className={`text-[15px] font-semibold py-2 whitespace-nowrap font-sans transition-colors ${
                isHome ? "text-kidsa-oragne-500" : "text-[#334155] hover:text-orange-500"
              }`}
            >
              Home
            </Link>
            <ProgramsDropdown
              open={programsOpen}
              onOpenChange={setProgramsOpen}
              programs={PROGRAMS}
              label={PROGRAMS_LABEL}
            />
            {NAV.filter((l) => l.href !== "/").map((link) => {
              const isActive = pathname === link.href || (link.href.startsWith("/#") && pathname === "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[15px] font-semibold py-2 whitespace-nowrap font-sans transition-colors ${
                    isActive ? "text-kidsa-oragne-500" : "text-[#334155] hover:text-orange-500"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link href="/#pricing" className="theme-btn ml-2">
              <span>Enroll Now</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        {mobileMenuOpen && (
          <MobileMenu
            programs={PROGRAMS}
            navLinks={NAV.filter((l) => l.href !== "/")}
            onClose={() => setMobileMenuOpen(false)}
            pathname={pathname}
          />
        )}
      </nav>
    </header>
  );
}

/** Logo: uses image when logoUrl provided, else fallback to styled GEN MUMINS. */
function Logo({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt="Gen-Mumins"
        width={180}
        height={72}
        className="h-16 w-auto object-contain"
        priority
      />
    );
  }
  return (
    <div className="relative" style={{ width: 180, height: 108 }}>
      <div className="flex items-start" style={{ gap: 2 }}>
        {["G", "E", "N"].map((letter, i) => (
          <div
            key={letter}
            className="font-playful rounded-lg flex items-center justify-center text-white"
            style={{
              width: 44,
              height: 44,
              backgroundColor: ["#85C1E9", "#DEB887", "#E8A87C"][i],
              fontSize: 22,
              fontWeight: 700,
              transform: ["rotate(-8deg)", "rotate(5deg)", "rotate(-3deg)"][i],
              marginTop: i === 1 ? 2 : 0,
            }}
          >
            {letter}
          </div>
        ))}
        <div className="ml-1 -mt-0.5">
          <Image
            src="/images/book.png"
            alt=""
            width={24}
            height={24}
            className="object-contain"
          />
        </div>
      </div>
      <div className="flex items-center mt-1 ml-0.5">
        <span className="text-[#2C3E50] text-sm font-bold tracking-[0.08em] font-sans">
          MUMINS
        </span>
        <div className="ml-1 -mt-0.5">
          <Image
            src="/images/girl-1.png"
            alt=""
            width={35}
            height={28}
            className="object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function ProgramsDropdown({
  open,
  onOpenChange,
  programs,
  label,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  programs: readonly { href: string; label: string }[];
  label: string;
}) {
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
    >
      <div className="flex items-center gap-x-1.5 py-2 whitespace-nowrap text-[15px] font-semibold text-[#334155]">
        <Link href="/programs" className="transition-colors hover:text-orange-500">
          {label}
        </Link>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-label={open ? "Collapse programs menu" : "Expand programs menu"}
          className="transition-colors hover:text-orange-500"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div
        className={`absolute left-0 top-full pt-2 w-52 z-[100] transition-all duration-200 ${
          open ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"
        }`}
      >
        <div className="rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden">
          <div className="py-2">
            {programs.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="block px-4 py-2.5 text-sm text-[#475569] hover:bg-orange-50 hover:text-orange-600 transition-colors"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMenu({
  programs,
  navLinks,
  onClose,
  pathname,
}: {
  programs: readonly { href: string; label: string }[];
  navLinks: readonly { href: string; label: string }[];
  onClose: () => void;
  pathname: string;
}) {
  const [programsOpen, setProgramsOpen] = useState(true);

  return (
    <div className="fixed inset-0 z-[60] xl:hidden">
      {/* Dark overlay */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-[#101827]/60"
      />

      {/* Sliding panel */}
      <div className="absolute inset-y-0 right-0 flex">
        <div className="h-full w-[82vw] max-w-md bg-[#FFF7ED] shadow-2xl border-l border-gray-200 overflow-hidden flex flex-col">
          {/* Header row with logo + close */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
            <div className="flex items-center gap-2">
              <Logo logoUrl={SITE.logoUrl || undefined} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F97316]/10 text-[#f97316] shadow-md"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF] mb-1">
              Kids Leadership Plan – Gen-Mu&rsquo;mins
            </p>

            {/* Main nav links */}
            <nav className="space-y-3 text-[15px] font-semibold text-[#374151]">
              <Link
                href="/"
                onClick={onClose}
                className={`flex items-center justify-between py-2 border-b border-gray-100 ${
                  pathname === "/" ? "text-kidsa-oragne-500" : "hover:text-orange-500"
                }`}
              >
                <span>Home</span>
              </Link>

              {/* Programs as expandable group */}
              <div className="border-b border-gray-100 pb-2">
                <div className="flex w-full items-center justify-between py-2 text-left">
                  <Link
                    href="/programs"
                    onClick={onClose}
                    className="text-[15px] font-semibold hover:text-orange-500"
                  >
                    {PROGRAMS_LABEL}
                  </Link>
                  
                  <button
                    type="button"
                    onClick={() => setProgramsOpen((prev) => !prev)}
                    aria-label={programsOpen ? "Collapse programs links" : "Expand programs links"}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#F59E0B] bg-[#FEF3C7] text-[#F97316]"
                  >
                    {programsOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {programsOpen && (
                  <div className="mt-1 space-y-1.5 pl-1.5">
                    {programs.map((p) => (
                      <Link
                        key={p.href}
                        href={p.href}
                        onClick={onClose}
                        className="flex items-center px-3 py-1.5 text-[14px] font-medium text-[#4B5563] hover:bg-white hover:text-[#9A3412]"
                      >
                        <span>{p.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={`flex items-center py-2 border-b border-gray-100 ${
                    pathname === link.href ? "text-kidsa-oragne-500" : "text-[#374151] hover:text-orange-500"
                  }`}
                >
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>

            {/* Contact info */}
            <div className="mt-6 border-t border-white/60 pt-4">
              <h3 className="text-[15px] font-semibold text-[#111827] mb-2">Contact Info</h3>
              <div className="space-y-2 text-[14px] text-[#4B5563]">
                <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 hover:text-orange-600">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FEF3C7] text-[#F97316]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span className="break-all">{SITE.email}</span>
                </a>
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-3 hover:text-orange-600"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FEF3C7] text-[#F97316]">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span>{SITE.phone}</span>
                </a>
              </div>
            </div>

            {/* Enroll button */}
            <div className="mt-6">
              <Link
                href="/pricing"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#EA580C] transition-colors"
              >
                <span>Enroll your Child</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {/* Social icons row */}
            <div className="mt-6 flex items-center justify-center gap-3 text-[#4B5563]">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-[#F9FAFB] hover:bg-[#FFF7ED] hover:border-[#F97316] hover:text-[#F97316] transition-colors"
                >
                  <svg
                    stroke="currentColor"
                    fill="currentColor"
                    strokeWidth="0"
                    viewBox={link.viewBox}
                    className="h-4 w-4"
                  >
                    <path d={link.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
