import { NextResponse } from "next/server";

import { sendManualPaymentSubmittedEmail } from "@/lib/email/notifications";
import { submitManualPaymentProof } from "@/lib/registration/payment-service";
import { manualPaymentProofSchema } from "@/lib/registration/payment-schema";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  try {
    const { paymentId } = await context.params;
    const payload = manualPaymentProofSchema.parse(await request.json());
    const submission = await submitManualPaymentProof(paymentId, payload);

    const transaction = await db.paymentTransaction.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            parent: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (transaction?.order) {
      await sendManualPaymentSubmittedEmail({
        orderNumber: transaction.order.orderNumber,
        parentName: `${transaction.order.parent.user.firstName} ${transaction.order.parent.user.lastName}`.trim(),
        parentEmail: transaction.order.parent.user.email,
        method: payload.manualMethod ?? "BANK_TRANSFER",
        referenceKey: submission.referenceKey,
      });
    }

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
