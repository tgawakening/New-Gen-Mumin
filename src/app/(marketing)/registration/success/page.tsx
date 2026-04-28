import { getStripeCheckoutSession } from "@/lib/payments/stripe";
import { markOrderPaid } from "@/lib/payments/fulfillment";

async function confirmStripeOrder(orderId?: string, sessionId?: string) {
  if (!orderId || !sessionId) {
    return;
  }

  const session = await getStripeCheckoutSession(sessionId);

  if (session.payment_status !== "paid") {
    return;
  }

  await markOrderPaid(orderId, {
    providerPaymentId: session.payment_intent?.toString() ?? null,
    providerReference: session.id,
    rawPayload: session,
    gateway: "STRIPE",
    subscriptionId: session.subscription?.toString() ?? null,
  });
}

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string; orderId?: string; session_id?: string }>;
}) {
  const params = await searchParams;

  if (params.gateway === "stripe") {
    await confirmStripeOrder(params.orderId, params.session_id);
  }

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-20">
      <div className="section-container">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#d7efdf] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#3a7a5e]">Payment received</p>
          <h1 className="mt-4 text-4xl font-semibold text-[#22304a]">Your registration is completed.</h1>
          <p className="mt-4 text-base leading-8 text-[#5f6b7a]">
            {params.gateway ? `Your ${params.gateway.toUpperCase()} payment flow completed successfully.` : "Your payment flow completed successfully."}
            {params.orderId ? ` Order ${params.orderId} has been confirmed.` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
