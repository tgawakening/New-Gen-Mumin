import { NextResponse } from "next/server";

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
