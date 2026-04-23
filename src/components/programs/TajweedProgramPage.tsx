import { getProgramContent } from "@/lib/program-content";
import { ProgramStandardPage } from "./ProgramStandardPage";

export function TajweedProgramPage() {
  const content = getProgramContent("tajweed");

  return (
    <ProgramStandardPage
      title="Qur'anic Tajweed Program"
      breadcrumbLabel="Qur'anic Tajweed Program"
      content={content}
      introImageSrc="/images/teaching.png"
      introImageAlt="Tajweed class illustration"
      goalsImageSrc="/images/teaching-2.png"
      goalsImageAlt="Learning goals illustration"
      pricingButtonClassName="mt-6 inline-flex rounded-2xl bg-[#F39F5F] px-8 py-4 text-sm md:text-base font-semibold text-white transition hover:bg-[#E78C4A]"
      goalsSectionContainerClassName="section-container relative overflow-hidden bg-[url('/images/left-shape.png')] bg-fill bg-no-repeat h-full"
    />
  );
}
