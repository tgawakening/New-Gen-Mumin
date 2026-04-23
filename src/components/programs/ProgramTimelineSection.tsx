"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ProgramCurriculumItem } from "@/lib/program-content";

const CURRICULUM_CARD_ICONS = [
  "/svgexport-21.svg",
  "/svgexport-22.svg",
  "/svgexport-30.svg",
  "/svgexport-12.svg",
];

type ProgramTimelineSectionProps = {
  items: ProgramCurriculumItem[];
};

export function ProgramTimelineSection({ items }: ProgramTimelineSectionProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const node = timelineRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportCenter = window.innerHeight * 0.5;
      const rawProgress = ((viewportCenter - rect.top) / rect.height) * 100;
      const clampedProgress = Math.max(0, Math.min(100, rawProgress));

      setProgressPercent(clampedProgress);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return (
    <div ref={timelineRef} className="relative mx-auto mt-10 max-w-6xl">
      <div className="absolute left-1/2 top-0 hidden h-full w-[2px] -translate-x-1/2 bg-[#D1D5DB] md:block" />
      <div
        className="absolute left-1/2 top-0 hidden w-[2px] -translate-x-1/2 bg-[#2F5A7D] transition-[height] duration-150 md:block"
        style={{ height: `${progressPercent}%` }}
      />
      <div
        className="absolute left-1/2 hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2F5A7D] shadow md:block"
        style={{ top: `${progressPercent}%` }}
      />

      <div className="space-y-8 md:space-y-10">
        {items.map((item, itemIndex) => (
          <div key={item.title} className="relative grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
            {itemIndex % 2 === 0 ? (
              <article className="rounded-sm border border-[#E5E7EB] bg-white px-5 py-6 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
                <h4 className="text-left font-heading text-lg font-bold text-[#2F4A5D]">
                  {item.title}
                </h4>
                <ul className="mt-3 space-y-2 text-sm font-medium leading-relaxed text-[#6B7280]">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-1.5">
                      <Image
                        src="/svgexport-2.svg"
                        alt=""
                        width={10}
                        height={10}
                        className="mt-1 h-5 w-5"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : (
              <div className="hidden md:block" />
            )}

            <div className="z-10 mx-auto hidden h-10 w-10 md:h-16 md:w-16 items-center justify-center rounded-full bg-[#2F5A7D] md:flex">
              <Image src={CURRICULUM_CARD_ICONS[itemIndex] ?? CURRICULUM_CARD_ICONS[0]} alt="" width={22} height={22} />
            </div>

            {itemIndex % 2 === 1 ? (
              <article className="rounded-sm border border-[#E5E7EB] bg-white px-5 py-6 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
                <h4 className="text-left font-heading text-lg font-bold text-[#2F4A5D]">
                  {item.title}
                </h4>
                <ul className="mt-3 space-y-2 text-sm font-medium leading-relaxed text-[#6B7280]">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-1.5">
                      <Image
                        src="/svgexport-2.svg"
                        alt=""
                        width={10}
                        height={10}
                        className="mt-1 h-5 w-5"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : (
              <div className="hidden md:block" />
            )}

            <article className="rounded-sm border border-[#E5E7EB] bg-white px-5 py-6 shadow-[0_8px_28px_rgba(0,0,0,0.08)] md:hidden">
              <h4 className="text-left font-heading text-lg font-bold text-[#2F4A5D]">
                {item.title}
              </h4>
              <ul className="mt-3 space-y-2 text-sm font-medium leading-relaxed text-[#6B7280]">
                {item.points.map((point) => (
                  <li key={point} className="flex items-start gap-1.5">
                    <Image
                      src="/svgexport-2.svg"
                      alt=""
                      width={10}
                      height={10}
                      className="mt-1 h-5 w-5"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        ))}
      </div>
    </div>
  );
}
