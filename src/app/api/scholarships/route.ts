import { NextResponse } from "next/server";

import { createScholarshipApplication } from "@/lib/scholarship/service";
import { scholarshipPayloadSchema } from "@/lib/scholarship/schema";

export async function POST(request: Request) {
  try {
    const payload = scholarshipPayloadSchema.parse(await request.json());
    const application = await createScholarshipApplication(payload);

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
