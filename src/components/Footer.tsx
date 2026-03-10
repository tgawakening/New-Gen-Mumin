"use client";

import Link from "next/link";
import { Phone, Mail, ChevronUp, ArrowRight } from "lucide-react";
import { SITE } from "@/lib/config";

export function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="bg-[#334155] text-white py-12 md:py-16 overflow-hidden">
      <div className="section-container">
        {/* Logo + newsletter */}
        <div className="text-center mb-8">
          <p className="text-2xl font-bold mb-2">
            <span className="text-amber-400">G</span>
            <span className="text-orange-400">E</span>
            <span className="text-blue-400">N</span>{" "}
            <span className="text-white font-normal">MUMINS</span>
          </p>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Sign up to Leadership weekly newsletter to get the latest updates.
          </p>
        </div>

        {/* Contact row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
          <a
            href={`tel:${SITE.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Phone className="h-5 w-5" />
            <span>{SITE.phone}</span>
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Mail className="h-5 w-5" />
            <span>{SITE.email}</span>
          </a>
          <Link href="/privacy-policy" className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors">
            Privacy Policy
          </Link>
        </div>

        <div className="flex justify-center mb-8">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-[#334155] font-bold py-3 px-6 rounded-full transition-all"
          >
            Contact Us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Copyright + socials */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-600">
          <p className="text-gray-400 text-sm">
            Copyright © {new Date().getFullYear()} Kids Leadership plan by TGA
          </p>
          <div className="flex items-center gap-4">
            {["Facebook", "Twitter", "Instagram", "YouTube", "TikTok"].map((label) => (
              <a
                key={label}
                href="#"
                className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center hover:bg-gray-500 transition-colors"
                aria-label={label}
              >
                <span className="text-xs font-bold">f</span>
              </a>
            ))}
            <button
              type="button"
              onClick={scrollToTop}
              className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors ml-2"
              aria-label="Scroll to top"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
