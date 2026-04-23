import { NextResponse } from "next/server";

import {
  sendScholarshipAdminNotificationEmail,
  sendScholarshipConfirmationEmail,
} from "@/lib/email/notifications";
import { createScholarshipApplication } from "@/lib/scholarship/service";
import { scholarshipPayloadSchema } from "@/lib/scholarship/schema";

export async function POST(request: Request) {
  try {
    const payload = scholarshipPayloadSchema.parse(await request.json());
    const application = await createScholarshipApplication(payload);

    await Promise.all([
      sendScholarshipConfirmationEmail({
        toEmail: application.parentEmail,
        parentName: application.parentName,
        requestedPercent: application.requestedPercent,
        offerTitle: application.offer?.title ?? "General support",
      }),
      sendScholarshipAdminNotificationEmail({
        parentName: application.parentName,
        parentEmail: application.parentEmail,
        requestedPercent: application.requestedPercent,
        offerTitle: application.offer?.title ?? "General support",
      }),
    ]);

    return NextResponse.json({
      applicationId: application.id,
      status: application.status,
      requestedPercent: application.requestedPercent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit scholarship application.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
