import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { GraduationCap } from "lucide-react";

const BLOB_FILL = "#F6A066";
const NAVY = "#2C4E68";
const DESC = "#5A6B7A";
const TAGLINE = "#F6A066";
const WAVE = "#FDF5ED";
const PATH_STROKE = "#B8C5CE";

/** Organic blob (matches live-04 hand-drawn feel). */
function ProgramBlob({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative flex h-[88px] w-[88px] shrink-0 items-center justify-center lg:h-[96px] lg:w-[96px] xl:h-[100px] xl:w-[100px] ${className}`}
    >
      {/* <svg
        className="absolute inset-0 h-full w-full drop-shadow-sm"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <path
          fill={BLOB_FILL}
          d="M50 4c12 0 22 6 28 14 8 4 14 12 16 22 2 14-2 26-12 34-8 10-20 16-34 14-12-2-22-10-26-22-6-10-4-24 4-34C36 12 42 6 50 4z"
        />
      </svg> */}
      <Image src="/images/icon-bg-1.png" alt="Blob" width={100} height={100} className="absolute inset-0 h-full w-full drop-shadow-sm" />
      <div className="relative z-10 text-white [&_svg]:stroke-[1.75]">{children}</div>
    </div>
  );
}


function BottomScallops() {
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-12 w-[120%] min-w-full -translate-x-1/2 overflow-hidden md:h-14"
      aria-hidden
    >
      <svg
        className="absolute bottom-0 left-0 h-full w-full min-w-[100%]"
        viewBox="0 0 1200 56"
        preserveAspectRatio="none"
        role="presentation"
      >
        <path
          fill={WAVE}
          d="M0,56 L0,40 Q25,8 50,40 T100,40 T150,40 T200,40 T250,40 T300,40 T350,40 T400,40 T450,40 T500,40 T550,40 T600,40 T650,40 T700,40 T750,40 T800,40 T850,40 T900,40 T950,40 T1000,40 T1050,40 T1100,40 T1150,40 T1200,40 L1200,56 Z"
        />
      </svg>
    </div>
  );
}

function TrackText({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="w-full max-w-[17.5rem] px-2 text-center sm:max-w-[18rem] lg:max-w-[12rem] lg:px-1 xl:max-w-[13rem]">
      <h3
        className="font-heading text-base font-bold leading-snug lg:text-sm lg:leading-snug xl:text-[0.95rem] 2xl:text-base"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed lg:mt-1.5 lg:text-xs xl:text-[0.8125rem]" style={{ color: DESC }}>
        {desc}
      </p>
    </div>
  );
}

function MobileProgramCard({
  href,
  title,
  desc,
  children,
}: {
  href: string;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-5 text-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6A066]/50 focus-visible:ring-offset-2"
    >
      <ProgramBlob>{children}</ProgramBlob>
      <TrackText title={title} desc={desc} />
    </Link>
  );
}

export function ExploreProgramsSection({ id }: { id: string }) {
  const data =[
    {
      title: "Arabic Learning Track",
      desc: "Learn Arabic reading and basics step by step.",
      href: "/programs/arabic",
      icon: "/svgexport-4.svg",
    },
    {
      title: "Seerah Storytelling Track",
      desc: "Discover the Prophet's life through simple stories.",
      href: "/programs/seerah",
      icon: "/svgexport-5.svg",
    },
    {
      title: "Qur'anic Tajweed Track",
      desc: "Practice Qur'an recitation with easy tajweed rules.",
      href: "/programs/tajweed",
      icon: "/svgexport-13.svg",
    },
    {
      title: "Life Lessons & Leadership Track",
      desc: "Build manners, confidence, and leadership skills.",
      href: "/programs/life-lessons",
      icon: "/svgexport-6.svg",
    }
  ]
  return (
    <section
      id={id}
      className="relative overflow-hidden bg-white pb-24 pt-16 md:pb-28 md:pt-20 lg:pb-32 lg:pt-24"
    >
      <div className="section-container relative z-10">
        <header className="mb-12 text-center md:mb-14 lg:mb-16">
          <p
            className="font-heading mb-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] sm:text-xs md:text-sm"
            style={{ color: TAGLINE }}
          >
            Learn. Grow. Lead.
          </p>
          <h2
            className="font-heading text-[1.65rem] font-bold leading-tight sm:text-3xl md:text-4xl lg:text-[2.65rem] lg:leading-tight"
            style={{ color: NAVY }}
          >
            Explore Our Programs
          </h2>
        </header>

        <div className="mx-auto w-full">
          {/* <PathConnector /> */}

          {/* Below lg: four stacked cards — blob, then title, then description (mobile reference) */}
          <div className="mx-auto flex max-w-sm flex-col items-center gap-14 px-4 sm:max-w-md sm:gap-16 lg:hidden">
            {data.map((item) => (
              <MobileProgramCard
                key={item.href}
                href={item.href}
                title={item.title}
                desc={item.desc}
              >
                <Image src={item.icon} alt="Blob" width={100} height={100} className="h-9 w-9 xl:h-10 xl:w-10" />
              </MobileProgramCard>
            ))}
          </div>

          {/* lg+: 5-column zig-zag; translate-y aligns blob centers with path */}
          <div className="mx-auto hidden w-full lg:grid lg:grid-cols-4 lg:gap-x-2 lg:px-1 xl:gap-x-4 xl:px-2">
            {data.map((item , index) => (
              index % 2 === 0 ? (
                <div key={item.href} className="flex min-h-[360px] flex-col items-center justify-center lg:min-h-[380px] xl:min-h-[400px]">
                  <Link
                    href={item.href}
                    className="flex flex-col items-center gap-4 transition-opacity hover:opacity-90 lg:translate-y-2 xl:translate-y-3"
                  >
                    <ProgramBlob>
                      <Image src={item.icon} alt="Blob" width={100} height={100} className="h-9 w-9 xl:h-10 xl:w-10" />
                    </ProgramBlob>
                    <TrackText title={item.title} desc={item.desc} />
                    </Link>
                  </div>
                ) : (
                  <div key={item.href} className="flex min-h-[360px] flex-col items-center justify-center lg:min-h-[380px] xl:min-h-[400px]">
                    <Link
                      href={item.href}
                      className="flex flex-col items-center gap-4 transition-opacity hover:opacity-90 lg:translate-y-2 xl:translate-y-3"
                    >
                        <TrackText title={item.title} desc={item.desc} />
                      <ProgramBlob>
                        <Image src={item.icon} alt="Blob" width={100} height={100} className="h-9 w-9 xl:h-10 xl:w-10" />
                      </ProgramBlob>
                    </Link>
                  </div>
                )
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
