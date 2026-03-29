import Link from "next/link";
import Image from "next/image";
import { Users, BookOpen, Heart, GraduationCap, ArrowRight } from "lucide-react";
import { SITE } from "@/lib/config";

/** Join Now section - 4 feature cards, girl at desk (live-06/07). */
const FEATURES = [
  { icon: '/svgexport-7.svg', color: "bg-[#fef4de]", text: "Taught by real teachers." },
  { icon: '/svgexport-6.svg', color: "bg-[#e1f6fe]", text: "Designed for real results." },
  { icon: '/svgexport-8.svg', color: "bg-[#e6e8fc]", text: "Loved by kids, trusted by parents." },
  { icon: '/svgexport-9.svg' , color: "bg-[#fedfef]", text: "Life/leadership skills" },
] as const;

export function JoinNowSection() {
  return (
    <section className="relative py-16 md:py-20 lg:py-24 bg-white overflow-hidden">
      <div className="absolute top-8 left-4 md:left-8 lg:left-12 z-10 pointer-events-none w-[160px] md:w-[250px]" aria-hidden>
          <Image
            src="/images/pencil.png"
            alt=""
            width={200}
            height={150}
            className="w-full h-auto object-contain animate-sway-reverse object-left"
          />
        </div>
        <div className="absolute bottom-8 right-4 md:right-8 lg:right-12 z-10 pointer-events-none w-[100px] md:w-[120px]" aria-hidden>
          <Image
            src="/images/zebra.png"
            alt=""
            width={200}
            height={150}
            className="w-full h-auto object-contain animate-float object-left"
          />
        </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* Illustration column – recreate live-06 illustration using assets */}
          <div className="flex justify-center order-first">
            <div className="relative w-full max-w-[520px]">
              {/* Blobby background */}
              <Image
                src="/images/blue-bg.png"
                alt=""
                width={800}
                height={520}
                className="w-full h-auto object-contain"
                priority
              />
              {/* Child at desk */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[95%] max-w-[480px]">
                <Image
                  src="/images/childatdesk.png"
                  alt="Child at desk eager to learn"
                  width={800}
                  height={800}
                  className="w-full h-auto object-contain"
                />
              </div>
              {/* Optional pencil in top-left if you have it */}
              {/* <div className="absolute -top-4 -left-6 md:-left-10 w-[140px]">
                <Image src="/images/pencil-join.png" alt="" width={160} height={80} className="w-full h-auto object-contain" />
              </div> */}
            </div>
          </div>

          {/* Content column – text and feature cards on the right */}
          <div className="order-last">
            <span className="text-orange-500 font-bold text-lg lg:text-xl block mb-2">
              Don&apos;t Delay Your Child&apos;s Islamic Education
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-[2.6rem] font-serif font-bold text-[#334155] mb-6">
              Join now
            </h2>
            <p className="text-[#64748b] text-base md:text-lg lg:text-xl mb-6 leading-relaxed">
              Every moment matters. While the world is teaching your child something every day,{" "}
              <strong className="text-[#334155]">you have the power to guide them toward the Quran, Arabic, and Islam</strong>
              {" "}— starting now.
            </p>
            <p className="text-[#64748b] text-base md:text-lg lg:text-xl mb-8">
              Create your parent account and enroll your children in engaging, live classes that build{" "}
              <strong className="text-[#334155]">faith, confidence, and a strong connection to their deen</strong>.
              Quran, Arabic, Tajweed, and Islamic Studies — all in one place.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.text}
                    className="bg-white p-4 flex items-center gap-3"
                  >
                    <div className={`w-18 h-18 rounded-lg ${f.color} flex items-center justify-center flex-shrink-0`}>
                      <Image src={Icon as string} alt={f.text} width={90} height={90} className="h-9 w-9 text-white" />
                    </div>
                    <span className="text-[#334155] font-bold text-md">{f.text}</span>
                  </div>
                );
              })}
            </div>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-kidsa-oragne-500 hover:bg-kidsa-orange-600 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg"
            >
              Sign Up Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
