import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { getRegistrationOptions } from "@/lib/registration/service";

export default async function RegistrationPage() {
  const { offers, countries } = await getRegistrationOptions();

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-16 md:py-20">
      <div className="section-container">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#eadfcd] bg-white/90 px-6 py-10 text-center shadow-[0_22px_80px_rgba(115,84,38,0.08)] backdrop-blur sm:px-10 sm:py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
            Registration
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#22304a] md:text-5xl">
            Enrol into Gen-Mumins.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#5f6b7a]">
            Add parent details, children, programme choices, and payment in one simple popup.
          </p>

          <div className="mt-8 flex justify-center">
            <RegistrationForm offers={offers} countries={countries} autoOpen />
          </div>
        </div>
      </div>
    </div>
  );
}
