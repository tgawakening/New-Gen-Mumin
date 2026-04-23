import { getProgramContent } from "@/lib/program-content";
import { ProgramStandardPage } from "./ProgramStandardPage";

export function SeerahProgramPage() {
  const content = getProgramContent("seerah");

  return (
    <ProgramStandardPage
      title="Seerah program"
      breadcrumbLabel="Seerah program"
      content={content}
      introImageSrc="/images/reading-class.png"
      introImageAlt="Seerah class illustration"
      goalsImageSrc="/images/siblings-reading.png"
      goalsImageAlt="Learning goals illustration"
      heroFloatClassName="absolute left-20 top-20 hidden md:block z-10 animate-float-"
      pricingButtonClassName="mt-6 inline-flex rounded-2xl bg-[#F39F5F] px-8 py-4  text-sm md:text-base font-semibold text-white transition hover:bg-[#E78C4A]"
      goalsSectionContainerClassName="section-container relative overflow-hidden bg-[url('/images/left-shape.png')] bg-fill bg-no-repeat h-full"
    />
  );
}
