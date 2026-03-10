import Link from "next/link";
import { Lightbulb, BookOpen, Award, BookMarked, Users, ArrowRight, Check } from "lucide-react";

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
    <section id="pricing" className="relative py-16 md:py-20 lg:py-24 bg-[#FDF6EF] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-12">
          <div>
            <span className="text-orange-500 font-bold text-lg block mb-2">
              Shaping confident Muslim leaders of tomorrow
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#334155]">
              All-in-One Gen Mu&apos;mins Plan
            </h2>
          </div>
          <Link
            href="#courses"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-6 rounded-full transition-all"
          >
            Explore more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: Infographic */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="text-center mb-6">
              <p className="text-[#334155] font-bold text-lg">GEN-Mu&apos;mins</p>
              <p className="text-[#64748b] text-sm">Kids Leadership Program | Ages 5-10 | Nurturing Future Leaders</p>
            </div>
            <div className="relative flex flex-col items-center">
              <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                <Lightbulb className="h-12 w-12 text-amber-600" />
              </div>
              <p className="text-[#334155] font-bold text-sm mb-4">FAITH + CHARACTER</p>
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {TRAITS.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-semibold text-[#475569] bg-gray-100 px-3 py-1 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                {PILLARS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.label} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <Icon className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[#334155] text-sm">{p.label}</p>
                        <p className="text-[#64748b] text-xs">{p.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Pricing card */}
          <div className="relative">
            <span className="absolute -top-2 left-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded -rotate-12 z-10 shadow">
              Feutured
            </span>
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-[#6B5B95]">
              <h3 className="text-xl font-bold text-[#334155] mb-2">Gen Mu&apos;min bundle</h3>
              <p className="text-[#64748b] text-sm mb-4">All programs (6 Classes per week)</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-gray-400 line-through text-lg">£150</span>
                <span className="text-3xl font-bold text-[#334155]">£ 80</span>
                <span className="text-[#64748b] text-sm">/per month</span>
              </div>
              <ul className="space-y-2 mb-6">
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
    </section>
  );
}
