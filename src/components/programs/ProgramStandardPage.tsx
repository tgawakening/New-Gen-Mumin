import Image from "next/image";
import type { ProgramPageContent } from "@/lib/program-content";
import { InnerHeader } from "./InnerHeader";
import { ProgramTimelineSection } from "./ProgramTimelineSection";

const ICON_SRC = "/svgexport-1.svg";
const CURRICULUM_CARD_ICONS = [
  "/svgexport-13.svg",
  "/svgexport-26.svg",
  "/svgexport-6.svg",
  "/svgexport-27.svg",
];

type ProgramStandardPageProps = {
  title: string;
  breadcrumbLabel: string;
  content: ProgramPageContent;
  introImageSrc: string;
  introImageAlt: string;
  goalsImageSrc: string;
  goalsImageAlt: string;
  heroFloatClassName?: string;
  pricingButtonClassName?: string;
  goalsSectionContainerClassName?: string;
  curriculumLayout?: "cards" | "timeline";
};

export function ProgramStandardPage({
  title,
  breadcrumbLabel,
  content,
  introImageSrc,
  introImageAlt,
  goalsImageSrc,
  goalsImageAlt,
  heroFloatClassName = "absolute left-20 top-20 hidden md:block z-10 animate-float",
  pricingButtonClassName = "mt-6 inline-flex rounded-2xl bg-[#F39F5F] px-8 py-4 text-sm md:text-base font-semibold text-white hover:bg-[#E78C4A]",
  goalsSectionContainerClassName = "section-container relative overflow-hidden bg-[url('/images/left-shape.png')] bg-no-repeat bg-fill",
  curriculumLayout = "cards",
}: ProgramStandardPageProps) {
  return (
    <div className="bg-[#F3F3F3]">
      <InnerHeader title={title} breadcrumbLabel={breadcrumbLabel} />

      {/* SECTION 1 */}
      <section className="py-12 md:py-16">
        <div className="section-container">
          <div className="mx-auto grid gap-8 lg:grid-cols-[2fr_1fr] md:space-y-6 p-10 md:p-14 lg:p-20">
            {/* LEFT */}
            <div className="relative space-y-6 md:space-y-8">
              <div className="flex h-[170px] max:w-[300px] items-center justify-center rounded-2xl bg-[url('/images/left-shape.png')] bg-cover bg-no-repeat px-6 md:h-[250px]">
                <Image
                  src={introImageSrc}
                  alt={introImageAlt}
                  width={300}
                  height={160}
                  className="h-auto w-auto max-h-[170px] object-contain md:max-h-[300px]"
                />
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#F39F5F]">
                {content.trackLabel}
              </p>

              <h2 className="mt-2 font-heading text-4xl font-bold text-[#2F4A5D]">
                {content.headline}
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-7 text-[#6B7280]">
                {content.intro}
              </p>

              <div className={heroFloatClassName}>
                <Image
                  src="/images/shape-2.png"
                  alt=""
                  width={260}
                  height={160}
                  className="max-w-[60px] h-auto animate-float-horizontal"
                />
              </div>
            </div>

            {/* RIGHT */}
            <aside className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="border-b border-[#E5E7EB] pb-3 font-heading text-xl font-bold text-[#2F4A5D]">
                {content.methodsTitle}
              </h3>

              <ul className="mt-4 space-y-3 text-[#6B7280]">
                {content.methods.map((item,i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Image
                      src={item.icon}
                      alt={item.title}
                      width={14}
                      height={14}
                      className="mt-1 h-3.5 w-3.5 md:h-4 md:w-4"
                    />
                    <span className="font-medium text-base">{item.title}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-6 border-b border-[#E5E7EB] pb-3 font-heading text-xl font-bold text-[#2F4A5D]">
                {content.parentInfoTitle}
              </h3>

              <ul className="mt-4 space-y-3 text-[#6B7280]">
                {content.parentInfo.map((item,i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Image
                      src={item.icon}
                      alt=""
                      width={14}
                      height={14}
                      className="mt-1 h-3.5 w-3.5 md:h-4 md:w-4"
                    />
                    <span className="font-medium text-base">{item.title}</span>
                  </li>
                ))}
              </ul>

              <button className={pricingButtonClassName}>Pricing Details</button>
            </aside>
          </div>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="pb-14 pt-2 md:pb-16">
        <div className={goalsSectionContainerClassName}>
          <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-2">
            {/* IMAGE */}
            <div className="min-h-[400px] overflow-hidden">
              <Image
                src={goalsImageSrc}
                alt={goalsImageAlt}
                width={400}
                height={400}
                className=" w-auto h-[420px] object-cover"
              />
              <div className="absolute left-[10%] top-[10%]  hidden md:block z-10 animate-float">
                <Image
                  src="/images/rocket.png"
                  alt="Seerah class illustration"
                  width={260}
                  height={160}
                  className="h-auto w-auto animate-float-horizontal"
                />
              </div>
              <div className="absolute right-[50%]  bottom-[-8%]  hidden md:block z-10">
                <Image
                  src="/images/circle-1.png"
                  alt="Seerah class illustration"
                  width={300}
                  height={200}
                  className="h-[130px] w-auto"
                />
              </div>
            </div>

            {/* TEXT */}
            <div>
              <h3 className="font-heading text-5xl font-bold text-[#2F4A5D]">
                {content.goalsTitle}
              </h3>

              <ul className="mt-5 space-y-3 text-[#6B7280]">
                {content.goals.map((goal) => (
                  <li key={goal} className="flex items-start gap-2 text-sm">
                    <Image
                      src="/svgexport-2.svg"
                      alt=""
                      width={16}
                      height={16}
                      className="mt-1 h-5 w-5"
                    />
                    <span>{goal}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="absolute right-[10%]  top-[30%]  hidden md:block z-10">
              <Image
                src="/images/line-1.png"
                alt="Seerah class illustration"
                width={100}
                height={100}
                className="h-[150px] w-auto animate-float"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 */}
      <section className="pb-16 pt-4 md:pb-24">
        <div className="section-container">
          <h3 className="text-center font-heading text-5xl font-bold text-[#2F4A5D]">
            {content.curriculumTitle}
          </h3>

          {curriculumLayout === "timeline" ? (
            <ProgramTimelineSection items={content.curriculumItems} />
          ) : (
            <div className="mx-auto mt-10 grid w-auto gap-5 md:gap-8 md:grid-cols-2 xl:grid-cols-4">
              {content.curriculumItems.map((item, itemIndex) => (
                <article
                  key={item.title}
                  className="rounded-sm bg-white px-5 py-6 md:p-8 space-y-2 md:space-y-6 shadow-[0_8px_28px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex justify-center">
                    <span className="flex h-14 w-14 md:h-22 md:w-22 items-center justify-center bg-[url('/images/icon-bg-1.png')] bg-cover bg-no-repeat">
                      <Image
                        src={CURRICULUM_CARD_ICONS[itemIndex] ?? CURRICULUM_CARD_ICONS[0]}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 md:h-8 md:w-8"
                      />
                    </span>
                  </div>

                  <h4 className="text-center font-heading text-lg font-bold text-[#2F4A5D]">
                    {item.title}
                  </h4>

                  <ul className="space-y-2 text-sm md:text-base font-medium leading-relaxed text-[#6B7280]">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-1.5">
                        <Image
                          src="/svgexport-2.svg"
                          alt=""
                          width={10}
                          height={10}
                          className="mt-1 h-5 w-5"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
