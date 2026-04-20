import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { getRegistrationOptions } from "@/lib/registration/service";

export default async function RegistrationPage() {
  const { offers, countries } = await getRegistrationOptions();

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-16 md:py-20">
      <div className="section-container">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#eadfcd] bg-white/90 p-6 shadow-[0_22px_80px_rgba(115,84,38,0.08)] backdrop-blur sm:p-8 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
                Registration
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-[#22304a] md:text-5xl">
                Enrol your family into Gen-Mumins.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[#5f6b7a]">
                Complete parent details, add one or more children, choose the right programme combination,
                and select the payment method from one clean popup form.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-[#dce8e2] bg-[radial-gradient(circle_at_top,#eef8f2,transparent_58%),linear-gradient(180deg,#f7fbf8_0%,#ffffff_100%)] p-6 sm:p-8">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#e6efe9] bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3a7a5e]">4 programmes</p>
                    <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">Single options, paired study, or full bundle.</p>
                  </div>
                  <div className="rounded-2xl border border-[#e6efe9] bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3a7a5e]">Multi-child</p>
                    <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">50% off for second child onwards.</p>
                  </div>
                  <div className="rounded-2xl border border-[#e6efe9] bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3a7a5e]">Payments</p>
                    <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">Card, pay by link, PayPal, or bank transfer.</p>
                  </div>
                </div>

                <RegistrationForm offers={offers} countries={countries} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

