import { NextResponse } from "next/server";

import { submitManualPaymentProof } from "@/lib/registration/payment-service";
import { manualPaymentProofSchema } from "@/lib/registration/payment-schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await context.params;
    const payload = manualPaymentProofSchema.parse(await request.json());
    const submission = await submitManualPaymentProof(paymentId, payload);

    return NextResponse.json({
      submissionId: submission.id,
      submittedAt: submission.submittedAt,
      referenceKey: submission.referenceKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit manual payment proof.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

