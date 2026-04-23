import { getProgramContent } from "@/lib/program-content";
import { ProgramStandardPage } from "./ProgramStandardPage";

export function ArabicProgramPage() {
  const content = getProgramContent("arabic");

  return (
    <ProgramStandardPage
      title="Arabic Program"
      breadcrumbLabel="Arabic Program"
      content={content}
      introImageSrc="/images/reading-class.png"
      introImageAlt="Arabic class illustration"
      goalsImageSrc="/graph.svg"
      goalsImageAlt="Learning goals illustration"
      pricingButtonClassName="mt-6 inline-flex rounded-2xl bg-[#F39F5F] px-8 py-4  text-sm md:text-base font-semibold text-white transition hover:bg-[#E78C4A]"
      goalsSectionContainerClassName="section-container relative overflow-hidden bg-[url('/images/left-shape.png')] bg-fill bg-no-repeat h-full"
      curriculumLayout="timeline"
    />
  );
}
