import { ProgramsListingTemplate } from "@/components/programs";
import { PROGRAMS_LISTING_CONTENT } from "@/lib/program-content";

export default function ProgramsPage() {
  return <ProgramsListingTemplate content={PROGRAMS_LISTING_CONTENT} />;
}
