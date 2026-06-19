import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
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

function publicRedirectUrl(request: Request, path: string) {
  if (env.success && env.data.APP_URL) {
    return new URL(path, env.data.APP_URL);
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "genmumin.com";
  return new URL(path, `${forwardedProto}://${forwardedHost}`);
}

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getCurrentSession();
  const formData = await request.formData();
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!session) {
    return NextResponse.redirect(publicRedirectUrl(request, withNotice(returnTo, "Please log in again to prepare this recording.", "error")), 303);
  }

  try {
    const { recordingId } = await params;
    void ensureRecordingDriveViewUrl(recordingId, {
      id: session.user.id,
      role: session.user.role,
    })
      .then(() => {
        revalidatePath("/admin/recordings");
        revalidatePath("/teacher/recordings");
        revalidatePath("/student/recordings");
        revalidatePath("/parent/recordings");
      })
      .catch((error) => {
        console.error("Background recording preparation failed.", error);
      });

    return NextResponse.redirect(publicRedirectUrl(request, withNotice(returnTo, "Recording preparation started. Refresh after a minute.", "success")), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare this recording right now.";
    return NextResponse.redirect(publicRedirectUrl(request, withNotice(returnTo, message, "error")), 303);
  }
}
