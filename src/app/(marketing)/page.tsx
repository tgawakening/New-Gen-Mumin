import Image from "next/image";
import { SECTION_IDS } from "@/lib/config";
import { SectionHeading } from "@/components/ui/Section";
import {
  HeroSection,
  MissionSection,
  JoinNowSection,
  AllInOneSection,
  JoinMovementSection,
  MeetInstructorsSection,
  ExploreProgramsSection,
} from "@/components/home";

/** Teaching philosophy items (live has 6; we keep 4 core + can expand) */
const PHILOSOPHY_ITEMS = [
  { icon:'/svgexport-3.svg', color: "bg-[#fef4de]", title: "Love before Learning", desc: "Children learn best when they feel safe, valued, and cared for." },
  { icon: '/images/book.png', color: "bg-[#e1f6fe]", title: "Practical before Theoretical", desc: "Hands-on experiences help kids understand and remember better." },
  { icon: '/svgexport-7.svg', color: "bg-[#e6e8fc]", title: "Character before Academics", desc: "Building integrity, kindness, and responsibility shapes true leaders." },
  { icon: '/svgexport-9.svg', color: "bg-[#fedfef]", title: "Consistency before Intensity", desc: "Small, steady habits create stronger skills than occasional big efforts." },
] as const;

export default function HomePage() {
  return (
    <div className="bg-white min-h-screen overflow-x-hidden overflow-y-auto">
      <HeroSection />
      <MissionSection />

      {/* Teaching Philosophy - layout matches live-03: cloud top-left, central boy at bottom */}
      <section className="relative pt-16 md:pt-20 lg:pt-24 bg-gradient-to-b from-[#eff5f6] to-white overflow-hidden">
        {/* Top: wavy/cloud strip across section */}
        <div className="absolute top-0 left-0 right-0 z-0 pointer-events-none" aria-hidden>
          <Image
            src="/images/bottom.png"
            alt=""
            width={1024}
            height={77}
            className="w-full h-auto object-cover object-bottom rotate-180"
          />
        </div>
        {/* Top-left: cloud + rainbow graphic (as in live-03) */}
        <div className="absolute top-8 left-4 md:left-8 lg:left-12 z-10 pointer-events-none w-[140px] md:w-[180px]" aria-hidden>
          <Image
            src="/images/clouds.png"
            alt=""
            width={180}
            height={120}
            className="w-full h-auto object-contain animate-sway-reverse object-left"
          />
        </div>
        <div className="absolute top-10 right-4 md:right-8 lg:right-12 z-10 pointer-events-none w-[140px] md:w-[180px]" aria-hidden>
          <Image
            src="/images/rocket.png"
            alt=""
            width={180}
            height={120}
            className="w-full h-auto object-contain animate-sway object-left"
          />
        </div>
        <div className="section-container relative z-10">
          <SectionHeading subtitle="Inspiring Hearts and Mind" title="Our Teaching Philosophy" />
          <div className="grid lg:grid-cols-3 gap-5 md:gap-6 items-end">
            <div className="space-y-4">
              {PHILOSOPHY_ITEMS.slice(0, 2).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="p-4 md:p-5transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-20 h-20 ${item.color} rounded-xl flex items-center justify-center`}>
                        <Image src={Icon as string} alt={item.title} width={64} height={64} className="h-12 w-12 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#334155] text-lg mb-1">{item.title}</h3>
                        <p className="text-[#64748b] text-sm">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Center: boy illustration anchored at bottom of section (live-03) */}
            <div className="flex justify-center order-first lg:order-none items-end min-h-[280px] md:min-h-[340px]">
            <div className="relative w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px]">
                <Image
                  src="/images/cta-shape-2.png"
                  alt="Young Muslim boy with Quran, eager to learn"
                  width={320}
                  height={400}
                  className="w-full h-auto object-contain object-bottom"
                />
              </div>
              <div className="absolute w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px]">
                <Image
                  src="/images/child-holding-quran.png"
                  alt="Young Muslim boy with Quran, eager to learn"
                  width={320}
                  height={400}
                  className="w-full h-auto object-contain object-bottom"
                />
              </div>
            </div>
            <div className="space-y-4">
              {PHILOSOPHY_ITEMS.slice(2, 4).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="p-4 md:p-5 transition-all">
                    <div className="flex items-start gap-4 lg lg:flex-row-reverse">
                      <div className={`flex-shrink-0 w-20 h-20 ${item.color} rounded-xl flex items-center justify-center`}>
                        <Image src={Icon as string} alt={item.title} width={64} height={64} className="h-12 w-12 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#334155] text-lg mb-1">{item.title}</h3>
                        <p className="text-[#64748b] text-sm">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[40px] bg-gradient-to-t from-[#FDF6EF] to-white" />
      </section>

      <ExploreProgramsSection id={SECTION_IDS.courses} />

      <MeetInstructorsSection />

      <JoinNowSection />
      <AllInOneSection />
      <JoinMovementSection />

      {/* Quranic verse */}
      {/* <section className="relative py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/images/verse-bg-live.jpg" alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/95 to-amber-500/90" />
        </div>
        <div className="section-container relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-2xl md:text-4xl mb-4 leading-relaxed" style={{ fontFamily: "serif" }}>
              رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي
            </p>
            <p className="text-white/90 italic text-lg">&quot;My Lord, make me an establisher of prayer, and from my descendants.&quot;</p>
            <p className="text-sm text-white/70 mt-2">— Surah Ibrahim 14:40</p>
          </div>
        </div>
      </section> */}
    </div>
  );
}
