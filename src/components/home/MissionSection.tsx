"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Phone } from "lucide-react";
import { SECTION_IDS, SITE } from "@/lib/config";

const LIVE_BASE =
  "https://gen-mumins.globalawakening.digital/wp-content/uploads";

/** Mission pillars from live site (icon-list with check) */
const MISSION_PILLARS = [
  "Faith-Centered Growth",
  "Strong Muslim Identity",
  "Community Impact",
  "Leadership Excellence",
] as const;

/**
 * Our Mission & Vision section — layout matches live site inspect:
 * Left: about-wrapper (children banner, Quran/lantern, border-shape), decorative bus/dot.
 * Right: subtitle, heading, body, 2x2 pillars, Explore More + Call Us Now.
 */
export function MissionSection() {
  return (
    <section className="relative py-16 md:py-20 lg:py-24 overflow-hidden bg-white">
      {/* Child with lamp — bottom right of section, animates from top to bottom */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-8 lg:right-12 z-20 w-[120px] sm:w-[140px] md:w-[160px] animate-slide-in-from-top">
        <Image
          src={`${LIVE_BASE}/2025/12/Screenshot_2025-12-24_003516-removebg-preview.png`}
          alt=""
          width={170}
          height={300}
          className="object-contain drop-shadow-lg w-full h-auto"
          aria-hidden
        />
      </div>
      <div className="section-container">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
          {/* Left: illustrations — live about-wrapper structure */}
          <div className="relative order-2 lg:order-1 flex-1 min-h-[300px] lg:min-h-[400px] flex items-center justify-center">
            {/* Decorative: bus/car (float-bob-x), hidden tablet/mobile */}
            <div className="absolute top-0 left-[8%] z-10 hidden lg:block animate-float-horizontal">
              <Image
                src={`${LIVE_BASE}/2024/05/bus.png`}
                alt=""
                width={99}
                height={87}
                className="object-contain"
                aria-hidden
              />
            </div>
            {/* Dotted line (rounded-anim), hidden mobile */}
            <div className="absolute top-4 left-[15%] z-0 hidden md:block animate-float-slow">
              <Image
                src={`${LIVE_BASE}/2024/05/dot.png`}
                alt=""
                width={75}
                height={54}
                className="object-contain opacity-80"
                aria-hidden
              />
            </div>

            {/* Main illustration stack: children with banner + secondary + border */}
            <div className="relative w-full">
              <div className="relative w-full aspect-[4/5] max-h-[420px]">
                {/* Primary: children holding banner (Untitled-design-1.png) */}
                <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                  <Image
                    src={`${LIVE_BASE}/2026/01/Untitled-design-1.png`}
                    alt="Muslim children holding banner"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain object-center"
                  />
                </div>
                {/* Secondary: child with lantern, positioned bottom-right of illustration stack */}
                <div className="absolute -bottom-4 -right-4 md:-right-8 w-[140px] md:w-[160px]">
                  <Image
                    src={`${LIVE_BASE}/2025/12/Screenshot_2025-12-24_003915-removebg-preview.png`}
                    alt=""
                    width={160}
                    height={180}
                    className="object-contain drop-shadow-lg"
                    aria-hidden
                  />
                </div>
                {/* Border shape overlay (live: border-shape-1) */}
                <div className="absolute inset-0 pointer-events-none">
                  <Image
                    src={`${LIVE_BASE}/2024/05/border-shape-1.png`}
                    alt=""
                    fill
                    sizes="(max-width: 420px) 100vw, 420px"
                    className="object-contain"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: content */}
          <div className="order-1 lg:order-2 flex-1 text-center lg:text-left">
            <span className="font-bold text-lg text-kidsa-orange-500 block mb-2">
              Guided by Faith, Driven by Purpose
            </span>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-kidsa-text-700 mb-4">
              Our Mission & Vision
            </h2>
            <p className="text-kidsa-text-500 text-base md:text-lg leading-relaxed mb-2">
              We are raising Gen-Mumins—young Muslims who know who they are,
              stand strong in their faith, and lead with kindness, courage, and
              character.
            </p>
            <p className="text-kidsa-text-500 text-base md:text-lg leading-relaxed font-medium mb-6">
              Because strong faith today builds leaders for tomorrow.
            </p>

            {/* 2x2 pillar grid — live icon-list with check-circle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {MISSION_PILLARS.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 bg-white/80 rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-kidsa-orange-100 flex items-center justify-center">
                    <Check className="h-5 w-5 text-kidsa-orange-500" strokeWidth={2.5} />
                  </div>
                  <span className="text-kidsa-text-600 font-semibold text-sm">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            {/* CTAs: Explore More (theme-btn) + Call Us Now (outline style) */}
            <div className="flex flex-col sm:flex-row gap-4 items-center lg:items-start">
              <Link
                href={`#${SECTION_IDS.courses}`}
                className="theme-btn"
              >
                <span>Explore More</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                className="theme-btn theme-btn--outline inline-flex items-center gap-3"
              >
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-kidsa-orange-100 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-kidsa-orange-500" />
                </span>
                <div className="flex flex-col items-start text-left">
                  <span className="text-xs font-medium text-kidsa-orange-500 leading-tight">
                    Call Us Now
                  </span>
                  <span className="text-sm font-bold text-kidsa-text-700 leading-tight">
                    {SITE.phone}
                  </span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
