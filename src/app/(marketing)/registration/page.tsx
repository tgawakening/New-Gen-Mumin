import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { getRegistrationOptions } from "@/lib/registration/service";

export default async function RegistrationPage() {
  const { offers, countries } = await getRegistrationOptions();

  return (
    <div className="bg-[#FDF6EF] py-16 md:py-20">
      <div className="section-container space-y-10">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
            Registration Workflow
          </p>
          <h1 className="mt-4 text-4xl font-bold text-[#334155] md:text-5xl">
            Enroll Your Child into Gen-Mumins
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-[#64748b]">
            This first production-facing setup captures parent details, multiple child entries, offer selections,
            and draft pricing so we can attach gateway payments, scholarships, renewals, and LMS enrollment status on top.
          </p>
        </div>

        <RegistrationForm offers={offers} countries={countries} />
      </div>
    </div>
  );
}
