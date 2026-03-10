"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, ChevronDown, ArrowRight } from "lucide-react";
import { PROGRAMS, PROGRAMS_LABEL, NAV, SITE } from "@/lib/config";

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
                isHome ? "text-kidsa-orange-500" : "text-[#334155] hover:text-orange-500"
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
                    isActive ? "text-kidsa-orange-500" : "text-[#334155] hover:text-orange-500"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link href="/registration" className="theme-btn ml-2">
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
      <button
        type="button"
        className="flex items-center gap-x-1.5 text-[15px] font-semibold py-2 whitespace-nowrap text-[#334155] hover:text-orange-500 transition-colors"
      >
        {label}
        <ChevronDown className="h-4 w-4" />
      </button>
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
  return (
    <div className="py-4 space-y-2 border-t border-gray-200 xl:hidden">
      <Link
        href="/"
        className={`block py-2 font-semibold ${pathname === "/" ? "text-kidsa-orange-500" : "text-[#334155] hover:text-orange-500"}`}
        onClick={onClose}
      >
        Home
      </Link>
      <div className="py-2">
        <span className="block text-sm text-[#64748b] font-medium mb-2">{PROGRAMS_LABEL}</span>
        {programs.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="block py-1.5 pl-4 text-[#475569] text-sm hover:text-orange-600"
            onClick={onClose}
          >
            {p.label}
          </Link>
        ))}
      </div>
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`block py-2 font-semibold ${pathname === link.href ? "text-kidsa-orange-500" : "text-[#334155] hover:text-orange-500"}`}
          onClick={onClose}
        >
          {link.label}
        </Link>
      ))}
      <div className="pt-4">
        <Link href="/registration" className="theme-btn" onClick={onClose}>
          <span>Enroll Now</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
