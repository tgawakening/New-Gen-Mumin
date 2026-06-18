import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { ensureRecordingDriveViewUrl } from "@/lib/live-classes/recordings";

type RouteProps = {
  params: Promise<{ recordingId: string }>;
};

function safeReturnTo(rawValue: FormDataEntryValue | null) {
  const value = typeof rawValue === "string" ? rawValue : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/recordings";
}

function withNotice(path: string, message: string, tone: "success" | "error") {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("notice", message);
  params.set("tone", tone);
  return `${pathname}?${params.toString()}`;
}

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getCurrentSession();
  const formData = await request.formData();
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!session) {
    return NextResponse.redirect(new URL(withNotice(returnTo, "Please log in again to prepare this recording.", "error"), request.url), 303);
  }

  try {
    const { recordingId } = await params;
    await ensureRecordingDriveViewUrl(recordingId, {
      id: session.user.id,
      role: session.user.role,
    });

    revalidatePath("/admin/recordings");
    revalidatePath("/teacher/recordings");
    revalidatePath("/student/recordings");
    revalidatePath("/parent/recordings");

    return NextResponse.redirect(new URL(withNotice(returnTo, "Recording prepared successfully.", "success"), request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare this recording right now.";
    return NextResponse.redirect(new URL(withNotice(returnTo, message, "error"), request.url), 303);
  }
}
