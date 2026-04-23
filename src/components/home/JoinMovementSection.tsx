import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/config";

/** Dark teal CTA - Join the Gen Mu'mins Movement (live-09). */
export function JoinMovementSection() {
  return (
    <section className="relative overflow-hidden bg-[#71a6b2] ">
      {/* Top image shape (header-top-shape) rotated 180deg */}
      <div className="absolute top-0 left-0 right-0 z-0 pointer-events-none" aria-hidden>
        <Image
          src="/images/cta-bg.jpg"
          alt=""
          width={1920}
          height={92}
          className="w-full h-auto object-cover bg-white"
        />
      </div>

      {/* Left and right decorative assets (match live composition) */}
      <div className="absolute left-[4%] top-[58%] -translate-y-1/2 w-28 md:w-36 opacity-80 pointer-events-none z-10" aria-hidden>
        <Image src="/images/rocket.png" alt="" width={218} height={149} className="w-full h-auto object-contain" />
      </div>
      <div className="absolute right-0 bottom-0 min-w-[180px] pointer-events-none z-20" aria-hidden>
        <Image src="/images/pencil-3.png" alt="" width={200} height={200} className="w-full h-auto object-contain object-right" />
      </div>

      {/* Subtle line doodles near visual cluster */}
      {/* <div className="absolute right-[41%] top-[66%] w-16 md:w-24 h-16 md:h-24 rounded-full border border-white/40 pointer-events-none" aria-hidden />
      <div className="absolute right-[39%] top-[64%] w-24 md:w-32 h-24 md:h-32 rounded-full border border-white/30 pointer-events-none" aria-hidden />
      <div className="absolute right-[37%] top-[62%] w-32 md:w-40 h-32 md:h-40 rounded-full border border-white/20 pointer-events-none" aria-hidden /> */}

      <div className="section-container relative z-10 pt-8 md:pt-10">
        <div className="grid lg:grid-cols-2 items-center gap-8 lg:gap-10">
          <div className="max-w-[560px]">
            <p className="text-white/95 text-xl md:text-3xl font-semibold mb-3">
              Raising the leaders of tomorrow with faith
            </p>
            <h2 className="text-5xl md:text-5xl lg:text-6xl font-semibold text-white leading-[1.06] mb-8">
              Join the Gen Mu&apos;mins Movement
            </h2>
            <a
              href={SITE.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-[#334155] hover:bg-slate-100 font-semibold py-4 px-8 rounded-2xl transition-all shadow-md"
            >
              Join Our Community
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>

          {/* Right: cta shape + children holding books */}
          <div className="relative bottom-0 h-[300px] md:h-[360px] lg:h-[390px] hidden md:block">
            <Image
              src="/images/cta-shape-1.png"
              alt=""
              fill
              className="object-contain object-bottom scale-[1.03]"
              sizes="40vw"
            />
            <div className="absolute inset-x-0 bottom-[1%] mx-auto w-[70%]">
              <Image
                src="/images/childrens-holding-books.png"
                alt="Children holding books"
                width={512}
                height={512}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
