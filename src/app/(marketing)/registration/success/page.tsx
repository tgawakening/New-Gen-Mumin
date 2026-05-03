import { getStripeCheckoutSession } from "@/lib/payments/stripe";
import { markOrderPaid } from "@/lib/payments/fulfillment";

async function confirmStripeOrder(orderId?: string, sessionId?: string) {
  if (!orderId || !sessionId) {
    return null;
  }

  const session = await getStripeCheckoutSession(sessionId);

  if (session.payment_status !== "paid") {
    return null;
  }

  await markOrderPaid(orderId, {
    providerPaymentId: session.payment_intent?.toString() ?? null,
    providerReference: session.id,
    rawPayload: session,
    gateway: "STRIPE",
    subscriptionId: session.subscription?.toString() ?? null,
  });

  return {
    tone: "success" as const,
    message: "Your payment has been completed and you are enrolled in the course.",
  };
}

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string; orderId?: string; session_id?: string }>;
}) {
  const params = await searchParams;
  let notice:
    | {
        tone: "success" | "info";
        message: string;
      }
    | null = null;

  if (params.gateway === "stripe") {
    try {
      notice =
        (await confirmStripeOrder(params.orderId, params.session_id)) ??
        {
          tone: "info",
          message: "Your payment has been received. Your registration is being confirmed.",
        };
    } catch {
      notice = {
        tone: "info",
        message:
          "Your payment appears to be completed. Please check your dashboard in a moment while we finish confirmation.",
      };
    }
  }

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-20">
      <div className="section-container">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#d7efdf] bg-white p-8 text-center shadow-sm">
          {notice ? (
            <div
              className={`mx-auto mb-6 max-w-2xl rounded-2xl border px-4 py-3 text-sm font-medium ${
                notice.tone === "success"
                  ? "border-[#cfe9d8] bg-[#edf8ef] text-[#2f6b4b]"
                  : "border-[#d7e5f2] bg-[#f5fbff] text-[#38506a]"
              }`}
            >
              {notice.message}
            </div>
          ) : null}
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
