import { ScholarshipForm } from "@/components/scholarship/ScholarshipForm";
import { getRegistrationOptions } from "@/lib/registration/service";

export default async function ScholarshipRegistrationPage() {
  const { offers } = await getRegistrationOptions();

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-16 md:py-20">
      <div className="section-container space-y-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
            Fee Waiver Application
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#22304a] md:text-5xl">
            Apply for Gen-Mumins scholarship support.
          </h1>
          <p className="mt-4 text-base leading-8 text-[#5f6b7a]">
            We want sincere families to benefit from Gen-Mumins even when finances are tight.
            Complete the fee waiver form below and our team will review the request manually.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <ScholarshipForm offers={offers.map((offer) => ({ slug: offer.slug, title: offer.title }))} />
        </div>
      </div>
    </div>
  );
}
