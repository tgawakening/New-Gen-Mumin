"use client";

import Link from "next/link";
import Image from "next/image";
import { Phone, Mail, ChevronUp, ArrowRight, Lock } from "lucide-react";
import { SITE } from "@/lib/config";

export function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="relative text-white py-12 md:py-16 overflow-hidden">
      {/* Single background image behind the overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden
      >
        <Image
          src="/images/footer-image.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority={false}
        />
      </div>
      {/* Dark overlay so content stays readable */}
      <div className="absolute inset-0 bg-[#3b5361]/80 z-[1]" aria-hidden />

      <div className="section-container relative z-10 space-y-8">
        {/* Logo + newsletter */}
        <div className="text-center">
          <Link href="/" className="inline-block mb-2">
            <Image
              src={SITE.logoUrl}
              alt="Gen-Mumins"
              width={180}
              height={72}
              className="h-14 w-auto object-contain mx-auto"
            />
          </Link>
          <p className="text-white text-sm max-w-md mx-auto">
            Sign up to Leadership weekly newsletter to get the latest updates.
          </p>
        </div>

        {/* Contact row – phone, email, Privacy Policy with icons */}
        <div className="flex flex-col sm:flex-row items-center border-y border-y-2 border-opacity-[10] py-6 justify-center gap-12">
          <a
            href={`tel:${SITE.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2  hover:text-amber-300 transition-colors"
          >
            <Phone className="h-8 w-8 shrink-0 text-amber-400" />
            <span className="text-white font-bold">{SITE.phone}</span>
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="flex items-center gap-2 hover:text-amber-300 transition-colors"
          >
            <Mail className="h-8 w-8 shrink-0 text-amber-400" />
            <span className="text-white font-bold">{SITE.email}</span>
          </a>
          <Link
            href="/privacy-policy"
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Lock className="h-8 w-8 shrink-0 text-amber-400" />
            <span className="text-white font-bold">Privacy Policy</span>
          </Link>
        </div>

        {/* Contact Us button – yellow/orange gradient, rounded, with arrow */}
        <div className="flex justify-center">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black font-bold py-3 px-6 rounded-xl transition-all shadow-md"
          >
            Contact Us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Copyright + socials */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-600">
          <p className="text-white text-sm">
            Copyright © 2026 Kids Leadership plan by TGA
          </p>
          <div className="flex items-center gap-2">
            {[
              { label: "Facebook", href: "#" },
              { label: "Twitter", href: "#" },
              { label: "Instagram", href: "#" },
              { label: "YouTube", href: "#" },
              { label: "TikTok", href: "#" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="w-9 h-9 rounded-lg bg-gray-600/80 flex items-center justify-center hover:bg-gray-500 transition-colors text-white"
                aria-label={label}
              >
                <span className="text-xs font-bold">
                  {label === "Facebook" && "f"}
                  {label === "Twitter" && "𝕏"}
                  {label === "Instagram" && "📷"}
                  {label === "YouTube" && "▶"}
                  {label === "TikTok" && "♪"}
                </span>
              </a>
            ))}
            <button
              type="button"
              onClick={scrollToTop}
              className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors ml-2 shrink-0"
              aria-label="Scroll to top"
            >
              <ChevronUp className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
