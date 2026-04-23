import type { ProgramPageContent } from "@/lib/program-content";
import { InnerHeader } from "./InnerHeader";
import { ProgramFeatureSection } from "./ProgramFeatureSection";
import { ProgramGoalsSection } from "./ProgramGoalsSection";
import { ProgramCurriculumSection } from "./ProgramCurriculumSection";

type ProgramTemplateProps = {
  content: ProgramPageContent;
};

export function ProgramTemplate({ content }: ProgramTemplateProps) {
  return (
    <div className="bg-[#FDF6EF]">
      <InnerHeader title={content.pageTitle} breadcrumbLabel={content.breadcrumbLabel} />
      <section className="bg-[#FDF6EF] py-10 md:py-12">
        <div className="section-container">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-orange-100 md:p-8 lg:p-10">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-orange-500 md:text-sm">
              {content.trackLabel}
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#334155] md:text-4xl">{content.headline}</h2>
            <p className="mt-4 max-w-4xl text-base leading-relaxed text-[#64748b] md:text-lg">{content.intro}</p>
          </div>
        </div>
      </section>
      <ProgramFeatureSection
        methodsTitle={content.methodsTitle}
        methods={content.methods}
        parentInfoTitle={content.parentInfoTitle}
        parentInfo={content.parentInfo}
      />
      <ProgramGoalsSection title={content.goalsTitle} goals={content.goals} />
      <ProgramCurriculumSection
        title={content.curriculumTitle}
        kind={content.curriculumKind}
        items={content.curriculumItems}
      />
    </div>
  );
}
