import type { ReactNode } from "react";
import Link from "next/link";
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
      <svg
        className="absolute inset-0 h-full w-full drop-shadow-sm"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <path
          fill={BLOB_FILL}
          d="M50 4c12 0 22 6 28 14 8 4 14 12 16 22 2 14-2 26-12 34-8 10-20 16-34 14-12-2-22-10-26-22-6-10-4-24 4-34C36 12 42 6 50 4z"
        />
      </svg>
      <div className="relative z-10 text-white [&_svg]:stroke-[1.75]">{children}</div>
    </div>
  );
}

function IconArabicBook() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" aria-hidden>
      <path d="M10 12h11a3 3 0 0 1 3 3v22a3 3 0 0 0-3-3H10V12z" />
      <path d="M38 12H27a3 3 0 0 0-3 3v22a3 3 0 0 1 3-3h11V12z" />
      <path d="M24 15v20" />
      <path d="M15 22a3 3 0 1 1 6 0c0 1.5-1 2.5-2 3h-2c-1-.5-2-1.5-2-3z" />
    </svg>
  );
}

/** Seerah / storytelling — bust with kufi-style cap (mobile reference). */
function IconPersonKufi() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
      <path d="M17 13.5h14l-1-2.5a7 7 0 0 0-12 0l-1 2.5z" />
      <path d="M16 13.5v2c0 1 .8 2 2 2h12c1.2 0 2-1 2-2v-2" />
      <circle cx="24" cy="21" r="5" />
      <path d="M13 38v-2c0-5.5 4.8-10 11-10s11 4.5 11 10v2" />
    </svg>
  );
}

function IconPersonEmblem() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="24" cy="16" r="6" />
      <path d="M14 38v-2c0-5 4.5-9 10-9s10 4 10 9v2" />
      <circle cx="24" cy="26" r="2.5" />
      <path d="M24 23.5v5M21.5 26h5" />
    </svg>
  );
}

function IconPersonReading() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="22" cy="14" r="5" />
      <path d="M14 34v-1c0-4 3.5-7 8-7" />
      <path d="M26 18h10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H26V18z" />
      <path d="M26 22h8M26 26h6" strokeLinecap="round" />
    </svg>
  );
}

/** Dotted journey line — viewBox x 40–460 matches five column centers (~10%, 28%, 50%, 72%, 90%). */
function PathConnector() {
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-[clamp(5.5rem,32vw,9.25rem)] z-0 hidden h-[clamp(6.75rem,19vw,9.5rem)] w-[min(94%,70rem)] max-w-[1080px] -translate-x-1/2 overflow-visible lg:block xl:top-[clamp(6rem,34vw,10rem)]"
      viewBox="0 0 500 120"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M 40 78 L 130 28 L 250 102 L 370 28 L 460 78"
        fill="none"
        stroke={PATH_STROKE}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 10"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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

        <div className="relative mx-auto w-full max-w-[1200px]">
          <PathConnector />

          {/* Below lg: four stacked cards — blob, then title, then description (mobile reference) */}
          <div className="relative z-[1] mx-auto flex max-w-sm flex-col items-center gap-14 px-4 sm:max-w-md sm:gap-16 lg:hidden">
            <MobileProgramCard
              href="/programs/arabic"
              title="Arabic Learning Track"
              desc="Learn Arabic reading and basics step by step."
            >
              <IconArabicBook />
            </MobileProgramCard>
            <MobileProgramCard
              href="/programs/seerah"
              title="Seerah Storytelling Track"
              desc="Discover the Prophet's life through simple stories."
            >
              <IconPersonKufi />
            </MobileProgramCard>
            <MobileProgramCard
              href="/programs/tajweed"
              title="Qur'anic Tajweed Track"
              desc="Practice Qur'an recitation with easy tajweed rules."
            >
              <IconPersonReading />
            </MobileProgramCard>
            <MobileProgramCard
              href="/programs/life-lessons"
              title="Life Lessons & Leadership Track"
              desc="Build manners, confidence, and leadership skills."
            >
              <GraduationCap className="h-9 w-9" strokeWidth={1.75} />
            </MobileProgramCard>
          </div>

          {/* lg+: 5-column zig-zag; translate-y aligns blob centers with path */}
          <div className="relative z-[1] mx-auto hidden min-h-[min(380px,52vw)] w-full grid-cols-5 gap-x-2 px-1 lg:grid lg:min-h-[400px] lg:gap-x-3 lg:px-2 xl:min-h-[420px] xl:gap-x-4">
            <div className="flex min-h-[360px] flex-col items-center justify-center lg:min-h-[380px] xl:min-h-[400px]">
              <Link
                href="/programs/arabic"
                className="flex flex-col items-center gap-4 transition-opacity hover:opacity-90 lg:translate-y-2 xl:translate-y-3"
              >
                <ProgramBlob>
                  <IconArabicBook />
                </ProgramBlob>
                <TrackText title="Arabic Learning Track" desc="Learn Arabic reading and basics step by step." />
              </Link>
            </div>

            <div className="flex min-h-[360px] flex-col items-center justify-center lg:min-h-[380px] xl:min-h-[400px]">
              <Link
                href="/programs/seerah"
                className="flex flex-col items-center gap-4 transition-opacity hover:opacity-90 lg:-translate-y-10 xl:-translate-y-11"
              >
                <TrackText
                  title="Seerah Storytelling Track"
                  desc="Discover the Prophet's life through simple stories."
                />
                <ProgramBlob>
                  <IconPersonKufi />
                </ProgramBlob>
              </Link>
            </div>

            <div className="flex min-h-[360px] flex-col items-center justify-center lg:min-h-[380px] xl:min-h-[400px]">
              <Link
                href="/programs/tajweed"
                className="flex flex-col items-center gap-4 transition-opacity hover:opacity-90 lg:-translate-y-10 xl:-translate-y-11"
              >
                <ProgramBlob>
                  <IconPersonReading />
                </ProgramBlob>
                <TrackText title="Qur'anic Tajweed Track" desc="Practice Qur'an recitation with easy tajweed rules." />
              </Link>
            </div>

            <div className="flex min-h-[360px] flex-col items-center justify-center lg:min-h-[380px] xl:min-h-[400px]">
              <Link
                href="/programs/life-lessons"
                className="flex flex-col items-center gap-4 transition-opacity hover:opacity-90 lg:translate-y-2 xl:translate-y-3"
              >
                <TrackText
                  title="Life Lessons & Leadership Track"
                  desc="Build manners, confidence, and leadership skills."
                />
                <ProgramBlob>
                  <GraduationCap className="h-9 w-9 xl:h-10 xl:w-10" strokeWidth={1.75} />
                </ProgramBlob>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
