import { getProgramContent } from "@/lib/program-content";
import { ProgramStandardPage } from "./ProgramStandardPage";

export function LifeLessonsProgramPage() {
  const content = getProgramContent("life-lessons");

  return (
    <ProgramStandardPage
      title="Life Lessons & Leadership Program"
      breadcrumbLabel="Life Lessons & Leadership Program"
      content={content}
      introImageSrc="/images/child-holding-quran.png"
      introImageAlt="Leadership class illustration"
      goalsImageSrc="/images/family.png"
      goalsImageAlt="Learning goals illustration"
    />
  );
}
