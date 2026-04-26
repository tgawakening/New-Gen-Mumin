import { redirect } from "next/navigation";

import { AddChildEnrollmentModal } from "@/components/registration/AddChildEnrollmentModal";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getRegistrationOptions } from "@/lib/registration/service";

export default async function ParentAddChildPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const [dashboard, options] = await Promise.all([
    getParentDashboardData(session.user.id),
    getRegistrationOptions(),
  ]);

  if (!dashboard) {
    redirect("/registration");
  }

  return (
    <div className="min-h-screen bg-[#f7f2ea] py-16">
      <div className="section-container">
        <div className="rounded-[32px] border border-[#eadfce] bg-white px-8 py-10 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
            Add another child
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">
            Continue enrollment for a new learner
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Your guardian details stay linked to the existing family account. Only the new child,
            programme choice, and payment step are needed here.
          </p>
        </div>
      </div>

      <AddChildEnrollmentModal
        parent={{
          parentName: dashboard.parentName,
          parentEmail: dashboard.parentProfile.email,
          phoneCountryCode: dashboard.parentProfile.phoneCountryCode,
          phoneNumber: dashboard.parentProfile.phoneNumber,
          billingCountryCode: dashboard.parentProfile.billingCountryCode,
          billingCountryName: dashboard.parentProfile.billingCountryName,
        }}
        offers={options.offers}
        countries={options.countries}
      />
    </div>
  );
}
