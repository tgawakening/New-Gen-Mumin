import Link from "next/link";
import Image from "next/image";
import { Users, BookOpen, Heart, GraduationCap, ArrowRight } from "lucide-react";
import { SITE } from "@/lib/config";

/** Join Now section - 4 feature cards, girl at desk (live-06/07). */
const FEATURES = [
  { icon: Users, color: "bg-amber-400", text: "Taught by real teachers." },
  { icon: BookOpen, color: "bg-blue-400", text: "Designed for real results." },
  { icon: Heart, color: "bg-violet-400", text: "Loved by kids, trusted by parents." },
  { icon: GraduationCap, color: "bg-pink-400", text: "Life/leadership skills" },
] as const;

export function JoinNowSection() {
  return (
    <section className="relative py-16 md:py-20 lg:py-24 bg-[#FDF6EF] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-orange-500 font-bold text-lg block mb-2">
              Don&apos;t Delay Your Child&apos;s Islamic Education
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#334155] mb-6">
              Join now
            </h2>
            <p className="text-[#64748b] text-lg mb-6 leading-relaxed">
              Every moment matters. While the world is teaching your child something every day,{" "}
              <strong className="text-[#334155]">you have the power to guide them toward the Quran, Arabic, and Islam</strong>
              {" "}— starting now.
            </p>
            <p className="text-[#64748b] text-lg mb-8">
              Create your parent account and enroll your children in engaging, live classes that build{" "}
              <strong className="text-[#334155]">faith, confidence, and a strong connection to their deen</strong>.
              Quran, Arabic, Tajweed, and Islamic Studies — all in one place.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.text}
                    className={`${f.color} rounded-xl p-4 flex items-center gap-3`}
                  >
                    <Icon className="h-6 w-6 text-white flex-shrink-0" />
                    <span className="text-[#334155] font-medium text-sm">{f.text}</span>
                  </div>
                );
              })}
            </div>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-full transition-all shadow-lg"
            >
              Sign Up Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
          <div className="flex justify-center">
            <div className="relative w-[280px] sm:w-[320px] aspect-square">
              <Image
                src="https://picsum.photos/320/320?random=join"
                alt="Child at desk learning"
                width={320}
                height={320}
                className="w-full h-full object-cover rounded-2xl shadow-xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
