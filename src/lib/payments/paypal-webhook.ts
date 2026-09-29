import { getAccessToken } from "@/lib/payments/paypal";
import { getPayPalBaseUrl } from "@/lib/payments/config";
let cachedWebhookId: string | undefined;
export async function verifyPayPalWebhook(request: Request, body: unknown) {
  const transmissionId = request.headers.get("paypal-transmission-id"), transmissionSig = request.headers.get("paypal-transmission-sig");
  if (!transmissionId || !transmissionSig) return false;
  const token = await getAccessToken();
  let webhookId = process.env.PAYPAL_WEBHOOK_ID || cachedWebhookId;
  if (!webhookId) {
    const response = await fetch(getPayPalBaseUrl() + "/v1/notifications/webhooks", { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Unable to discover PayPal webhook configuration.");
    const data = await response.json() as { webhooks?: Array<{ id: string; url: string }> };
    const expected = new URL("/api/payments/paypal/webhook", process.env.APP_URL || request.url).href;
    webhookId = data.webhooks?.find(w => w.url.replace(/\/$/, "") === expected)?.id;
    if (!webhookId) throw new Error("Configure PAYPAL_WEBHOOK_ID for the Gen-Mumin payment webhook.");
    cachedWebhookId = webhookId;
  }
  const response = await fetch(getPayPalBaseUrl() + "/v1/notifications/verify-webhook-signature", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ auth_algo: request.headers.get("paypal-auth-algo"), cert_url: request.headers.get("paypal-cert-url"), transmission_id: transmissionId, transmission_sig: transmissionSig, transmission_time: request.headers.get("paypal-transmission-time"), webhook_id: webhookId, webhook_event: body }),
  });
  if (!response.ok) throw new Error("PayPal verification unavailable; retry required.");
  const result = await response.json() as { verification_status?: string };
  return result.verification_status === "SUCCESS";
}
