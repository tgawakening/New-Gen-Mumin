import { NextResponse } from "next/server";

import {
  sendScholarshipApprovedEmail,
  sendScholarshipRejectedEmail,
} from "@/lib/email/notifications";
import { reviewScholarshipApplication } from "@/lib/scholarship/service";
import { scholarshipReviewSchema } from "@/lib/scholarship/schema";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await context.params;
    const payload = scholarshipReviewSchema.parse(await request.json());
    const application = await reviewScholarshipApplication(applicationId, payload);

    if (application.status === "APPROVED" && application.approvalToken) {
      await sendScholarshipApprovedEmail({
        toEmail: application.parentEmail,
        parentName: application.parentName,
        approvedPercent: application.requestedPercent,
        reviewNote: application.reviewNote ?? "Approved for support.",
        approvalToken: application.approvalToken,
      });
    }

    if (application.status === "REJECTED") {
      await sendScholarshipRejectedEmail({
        toEmail: application.parentEmail,
        parentName: application.parentName,
        reviewNote: application.reviewNote ?? "Thank you for applying.",
      });
    }

    return NextResponse.json({
      applicationId: application.id,
      status: application.status,
      approvalToken: application.approvalToken,
      tokenExpiresAt: application.tokenExpiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review scholarship application.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
