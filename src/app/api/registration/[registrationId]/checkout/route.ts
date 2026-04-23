import { NextResponse } from "next/server";

import { createCheckoutDraft } from "@/lib/registration/payment-service";
import { registrationCheckoutSchema } from "@/lib/registration/payment-schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ registrationId: string }> },
) {
  try {
    const { registrationId } = await context.params;
    const payload = registrationCheckoutSchema.parse(await request.json());
    const checkout = await createCheckoutDraft(registrationId, payload);

    return NextResponse.json(checkout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create checkout draft.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
