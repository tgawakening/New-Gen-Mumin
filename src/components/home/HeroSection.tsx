import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SECTION_IDS } from "@/lib/config";

/** Hero section structured to match live site inspect element. */
export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100svh-180px)] lg:min-h-[calc(100vh-184px)] flex flex-col overflow-hidden bg-[#FDF6EF] pt-4 md:pt-6 lg:pt-8">
      {/* Parasuit (hot air balloon) - absolute, hidden tablet/mobile, float animation */}
      <div className="absolute top-32 left-[40%] z-20 hidden lg:block animate-float">
        <Image
          src="/images/parasuit.png"
          alt=""
          width={68}
          height={94}
          className="object-contain drop-shadow-lg"
          aria-hidden
        />
      </div>

      {/* Left wavy line (paper plane trail) - live: left.png */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-0 hidden md:block">
        <Image
          src="/images/left.png"
          alt=""
          width={119}
          height={216}
          className="opacity-70 object-contain object-left"
          aria-hidden
        />
      </div>

      {/* Right decorative line - live: right.png */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-0 hidden lg:block">
        <Image
          src="/images/right.png"
          alt=""
          width={131}
          height={232}
          className="opacity-70 object-contain object-right"
          aria-hidden
        />
      </div>

      {/* Bottom clouds/decorative shape - in front of other images */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none" aria-hidden>
        <Image
          src="/images/bottom.png"
          alt=""
          width={1024}
          height={77}
          className="w-full h-auto object-cover object-bottom"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex-1 flex flex-col justify-end pb-0">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] items-end">
          {/* Left: content - live structure with star.svg at top */}
          <div className="text-center lg:text-left relative self-center">
            {/* Large decorative star - live: star.svg 740x740 */}
            <div className="flex justify-center lg:justify-start mb-4">
              <Image
                src="/images/star.svg"
                alt=""
                width={20}
                height={20}
                className="object-contain opacity-90"
                aria-hidden
              />
            </div>

            {/* Heading - live: "Raising Confident & Thoughtful" + span "Muslim" + " Leaders." */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3rem] font-heading font-bold leading-tight mb-6 text-[#4A5568]">
              Raising Confident & <br/>Thoughtful <span className="text-kidsa-orange-500">Muslim</span> Leaders.
            </h1>

            <p className="text-lg text-[#5C707E] max-w-xl mb-8 leading-relaxed mx-auto lg:mx-0 font-sans">
              A long-term immersive program teaching Arabic, Seerah, Qur&apos;anic
              Tajweed, and Life Skills.
            </p>

            {/* Buttons - theme-btn (filled) + theme-btn--outline, same size */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center flex-wrap">
              <Link href="/registration" className="theme-btn">
                <span>Enroll Now</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href={`#${SECTION_IDS.courses}`} className="theme-btn theme-btn--outline">
                <span>Gen-Mu&apos;mins Programme</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Image
                src="/images/star.png"
                alt=""
                width={54}
                height={54}
                className="object-contain flex-shrink-0 hidden sm:block"
                aria-hidden
              />
            </div>
          </div>

          {/* Right: hero-shape + children - aligned to bottom, emerging from clouds */}
          <div className="hidden md:block mt-8 lg:mt-0 relative w-full self-end">
            <div className="relative w-full" style={{ aspectRatio: "4/3", minHeight: 420 }}>
              {/* hero-shape.png - cloud blob, anchored at bottom */}
              <Image
                src="/images/hero-shape.png"
                alt=""
                width={740}
                height={566}
                className="absolute inset-x-0 bottom-0 w-full h-full object-contain object-bottom"
                aria-hidden
              />
              {/* Children - centered inside cloud */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src="/images/muslim-children-live.png"
                  alt="Muslim children celebrating"
                  width={360}
                  height={360}
                  className="w-[55%] max-w-[380px] h-auto object-contain drop-shadow-lg"
                  priority
                />
              </div>
              {/* Book, bee, pencil - absolute positioned */}
              <div className="absolute top-4 right-[10%] z-20 animate-float-horizontal">
                <Image src="/images/book.png" alt="" width={70} height={70} className="object-contain" aria-hidden />
              </div>
              <div className="absolute bottom-[30%] right-[8%] z-20 animate-float-reverse">
                <Image src="/images/bee-1.png" alt="" width={107} height={107} className="object-contain" aria-hidden />
              </div>
              <div className="absolute bottom-[15%] right-[18%] z-20 animate-float hidden lg:block">
                <Image src="/images/pencil-4.png" alt="" width={80} height={80} className="object-contain" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
