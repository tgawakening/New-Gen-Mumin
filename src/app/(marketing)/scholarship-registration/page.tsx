import { ScholarshipForm } from "@/components/scholarship/ScholarshipForm";
import { getRegistrationOptions } from "@/lib/registration/service";

export default async function ScholarshipRegistrationPage() {
  const { offers } = await getRegistrationOptions();

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-16 md:py-20">
      <div className="section-container space-y-8">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
            Scholarship Support
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#22304a] md:text-5xl">
            Apply for financial support for Gen-Mumins.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Families can apply for 25%, 50%, 75%, or full support. Your request will be reviewed by the admin team before approval.
          </p>
        </div>

        <ScholarshipForm offers={offers.map((offer) => ({ slug: offer.slug, title: offer.title }))} />
      </div>
    </div>
  );
}

