import { notFound } from "next/navigation";

import { PendingPaymentCard } from "@/components/registration/PendingPaymentCard";
import { db } from "@/lib/db";

type PageProps = {
  params: Promise<{ registrationId: string }>;
};

export default async function PendingRegistrationPage({ params }: PageProps) {
  const { registrationId } = await params;

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: {
      students: true,
      items: true,
    },
  });

  if (!registration) {
    notFound();
  }

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-16 md:py-20">
      <div className="section-container">
        <PendingPaymentCard
          registrationId={registration.id}
          currency={registration.selectedCurrency}
          totalAmount={registration.totalAmount}
          studentCount={registration.students.length}
          itemCount={registration.items.length}
          allowManual={registration.selectedCountryCode === "PK"}
          allowPayPal={registration.items.length === 1}
        />
      </div>
    </div>
  );
}
