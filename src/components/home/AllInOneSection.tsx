import Link from "next/link";
import { Lightbulb, BookOpen, Award, BookMarked, Users, ArrowRight, Check } from "lucide-react";
import Image from "next/image";

/** All-in-One Gen Mu'mins Plan - infographic + bundle card (live-08). */
const PILLARS = [
  { icon: BookOpen, label: "ARABIC", desc: "Language of the Quran. Explore & Connect." },
  { icon: Award, label: "TAJWEED & IJAZA", desc: "Recite with Excellence. Beautify your voice." },
  { icon: BookMarked, label: "SEERAH", desc: "Life of the Prophet (PBUH). Follow His Journey." },
  { icon: Users, label: "LEADERSHIP SKILLS", desc: "Inspire & Serve. Build teamwork & confidence." },
] as const;

const TRAITS = ["INTEGRITY", "WISDOM", "RESPECT", "KNOWLEDGE", "CREATIVITY", "COURAGE", "COMMUNITY"];

export function AllInOneSection() {
  return (
    <section id="pricing" className="relative py-16 md:py-20 lg:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-12">
          <div>
            <span className="text-orange-500 font-bold text-lg lg:text-xl block mb-2">
              Shaping confident Muslim leaders of tomorrow
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-[2.6rem] font-serif font-bold text-[#334155]">
              All-in-One Gen Mu&apos;mins Plan
            </h2>
          </div>
          <Link
            href="#courses"
            className="inline-flex items-center gap-2 bg-kidsa-oragne-500 hover:bg-kidsa-orange-600 text-white font-semibold py-3.5 px-6 rounded-xl transition-all"
          >
            Explore more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: Infographic image – clone of live-08 graphic */}
          <div className="p-6 sm:p-0 flex justify-center">
            <div className="w-full max-w-[420px]">
              <Image
                src="/images/gen-mumins.jpg"
                alt="GEN-Mu'mins infographic"
                width={600}
                height={800}
                className="w-full h-auto object-contain"
                priority
              />
            </div>
          </div>

          {/* Right: Pricing card – styled to match live layout */}
          <div className="relative">
            <span className="absolute -top-3 left-5 bg-kidsa-oragne-500 text-white text-xs font-bold px-3 py-1 rounded -rotate-12 z-10 shadow">
              Featured
            </span>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Top: small circular graphic and title */}
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-16 h-16 mx-auto rounded-full border border-gray-200 overflow-hidden mb-3 flex items-center justify-center bg-white">
                  <Image
                    src="/images/gen-mumins.jpg"
                    alt="Gen Mu'min bundle graphic"
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-xl font-bold text-[#334155] mb-1">Gen Mu&apos;min bundle</h3>
                <p className="text-[#64748b] text-sm mb-1">All programs (6 Classes per week)</p>
              </div>

              {/* Middle: orange price band */}
              <div className="bg-kidsa-oragne-500 text-white px-6 py-4 text-center">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-white/70 line-through text-lg">£150</span>
                  <span className="text-3xl font-bold">£ 80</span>
                  <span className="text-sm text-white/80">/per month</span>
                </div>
              </div>

              {/* Bottom: details and CTA */}
              <div className="px-6 py-5 bg-[#F9FAFB]">
                <ul className="space-y-2 mb-5">
                  <li className="flex items-center gap-2 text-[#475569] text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Arabic & Tajweed Program (2 classes per week)
                  </li>
                  <li className="flex items-center gap-2 text-[#475569] text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Seerah & Leadership Program (1 class per week)
                  </li>
                </ul>
                <Link
                  href="/registration"
                  className="block w-full text-center bg-[#6B5B95] hover:bg-[#5b4d85] text-white font-semibold py-3 px-4 rounded-full transition-all"
                >
                  Avail this offer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
