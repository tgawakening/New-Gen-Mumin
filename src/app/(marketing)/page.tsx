import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  BookOpen,
  Star,
  Award,
  GraduationCap,
} from "lucide-react";
import { SECTION_IDS } from "@/lib/config";
import { Section, SectionHeading } from "@/components/ui/Section";
import {
  HeroSection,
  MissionSection,
  JoinNowSection,
  AllInOneSection,
  JoinMovementSection,
} from "@/components/home";

/** Teaching philosophy items (live has 6; we keep 4 core + can expand) */
const PHILOSOPHY_ITEMS = [
  { icon: Heart, color: "bg-amber-400", title: "Love before Learning", desc: "Children learn best when they feel safe, valued, and cared for." },
  { icon: BookOpen, color: "bg-blue-400", title: "Practical before Theoretical", desc: "Hands-on experiences help kids understand and remember better." },
  { icon: Star, color: "bg-blue-400", title: "Character before Academics", desc: "Building integrity, kindness, and responsibility shapes true leaders." },
  { icon: Award, color: "bg-pink-400", title: "Consistency before Intensity", desc: "Small, steady habits create stronger skills than occasional big efforts." },
] as const;

/** Program tracks with live-04 ordering: Arabic, Seerah, Tajweed, Life Lessons */
const PROGRAMS_DATA = [
  { title: "Arabic Learning Track", desc: "Learn Arabic reading and basics step by step.", icon: BookOpen, href: "/programs/arabic", color: "orange" },
  { title: "Seerah Storytelling Track", desc: "Discover the Prophet's life through simple stories.", icon: BookOpen, href: "/programs/seerah", color: "orange" },
  { title: "Qur'anic Tajweed Track", desc: "Practice Qur'an recitation with easy tajweed rules.", icon: Star, href: "/programs/tajweed", color: "yellow" },
  { title: "Life Lessons & Leadership Track", desc: "Build manners, confidence, and leadership skills.", icon: GraduationCap, href: "/programs/life-lessons", color: "violet" },
] as const;

const INSTRUCTORS = [
  { name: "Ustadh Abubakar Sadique", role: "Program Director" },
  { name: "Ustadha Zeba Ghazal Quraishi", role: "Seerah Lead" },
  { name: "Ustadh Mehran Raziq", role: "Arabic & Islamic Content" },
  { name: "Ustadha Afira Tahir", role: "Arabic Level 1–2 Instructor" },
] as const;

const COLOR_MAP = {
  orange: { bar: "bg-orange-500", bg: "bg-orange-100", text: "text-orange-500" },
  blue: { bar: "bg-blue-500", bg: "bg-blue-100", text: "text-blue-500" },
  yellow: { bar: "bg-amber-500", bg: "bg-amber-100", text: "text-amber-500" },
  violet: { bar: "bg-[#6B5B95]", bg: "bg-[#ede9fe]", text: "text-[#6B5B95]" },
} as const;

export default function HomePage() {
  return (
    <div className="bg-[#FDF6EF] min-h-screen overflow-x-hidden overflow-y-auto">
      <HeroSection />
      <MissionSection />

      {/* Teaching Philosophy */}
      <section className="relative py-16 md:py-20 lg:py-24 bg-white">
        <div className="absolute top-0 left-0 right-0 h-[30px] bg-gradient-to-b from-[#FDF6EF] to-white" />
        <div className="section-container relative z-10">
          <SectionHeading subtitle="Inspiring Hearts and Mind" title="Our Teaching Philosophy" />
          <div className="grid lg:grid-cols-3 gap-5 md:gap-6 items-center">
            <div className="space-y-4">
              {PHILOSOPHY_ITEMS.slice(0, 2).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="bg-white rounded-2xl p-4 md:p-5 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 ${item.color} rounded-xl flex items-center justify-center`}>
                        <Icon className="h-6 w-6 text-white" />
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
            <div className="flex justify-center order-first lg:order-none">
              <div className="relative w-[240px] sm:w-[280px] md:w-[320px] aspect-[320/380] rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src="https://picsum.photos/320/380?random=philosophy"
                  alt="Muslim child learning"
                  width={320}
                  height={380}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="space-y-4">
              {PHILOSOPHY_ITEMS.slice(2, 4).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="bg-white rounded-2xl p-4 md:p-5 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 ${item.color} rounded-xl flex items-center justify-center`}>
                        <Icon className="h-6 w-6 text-white" />
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

      {/* Explore Programs - horizontal cloud-style (simplified for maintainability) */}
      <Section id={SECTION_IDS.courses}>
        <SectionHeading
          subtitle="Learn. Grow. Lead"
          title="Explore Our Programs"
          description="Four integrated tracks of a 2-year program designed to build a strong Islamic foundation in children aged 6-12 years."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROGRAMS_DATA.map((p) => {
            const Icon = p.icon;
            const colors = COLOR_MAP[p.color];
            return (
              <Link
                key={p.title}
                href={p.href}
                className="group relative bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all border border-gray-100"
              >
                <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl ${colors.bar}`} />
                <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform`}>
                  <Icon className={`h-7 w-7 ${colors.text}`} />
                </div>
                <h3 className="font-bold text-[#334155] mb-2">{p.title}</h3>
                <p className="text-[#64748b] text-sm">{p.desc}</p>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Meet Instructors */}
      <section className="relative py-16 md:py-20 lg:py-24 bg-[#6B5B95] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image src="https://picsum.photos/1920/600?random=instructors" alt="" fill className="object-cover" />
        </div>
        <div className="section-container relative z-10">
          <SectionHeading
            variant="dark"
            subtitle="A Team Dedicated To Faith, Knowledge, And Leadership"
            title="Meet Our Instructors"
            description="Qualified and experienced Islamic educators dedicated to nurturing young Muslims."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INSTRUCTORS.map((t) => (
              <div key={t.name} className="bg-white rounded-xl p-4 text-center shadow-lg text-[#334155]">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                  <span className="text-white text-sm font-bold">
                    {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <h3 className="font-bold mb-1">{t.name}</h3>
                <p className="text-orange-500 font-medium text-sm">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <JoinNowSection />
      <AllInOneSection />
      <JoinMovementSection />

      {/* Quranic verse */}
      <section className="relative py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0">
          <Image src="https://picsum.photos/1920/400?random=verse" alt="" fill className="object-cover" />
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
      </section>
    </div>
  );
}
