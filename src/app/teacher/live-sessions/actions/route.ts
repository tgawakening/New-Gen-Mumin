import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requestTeacherLiveClass } from "@/lib/live-classes/service";

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/live-sessions?${params.toString()}`;
}

function getPublicBaseUrl(request: NextRequest) {
  if (env.success) {
    return env.data.APP_URL;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function redirectTo(request: NextRequest, href: string) {
  return NextResponse.redirect(new URL(href, getPublicBaseUrl(request)), 303);
}

function weekdayFromDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay();
}

function revalidateLiveSessionViews() {
  revalidatePath("/teacher/live-sessions");
  revalidatePath("/teacher/schedule");
  revalidatePath("/admin/classes");
  revalidatePath("/student/schedule");
  revalidatePath("/parent/schedule");
}

async function createSession(request: NextRequest, formData: FormData, teacherUserId: string) {
  try {
    const schedule = await requestTeacherLiveClass(
      {
        programId: String(formData.get("programId") || ""),
        title: String(formData.get("title") || ""),
        startDate: String(formData.get("startDate") || ""),
        weekday: weekdayFromDateInput(String(formData.get("startDate") || "")) ?? 0,
        startTime: String(formData.get("startTime") || "16:00"),
        endTime: String(formData.get("endTime") || "17:00"),
        timezone: String(formData.get("timezone") || "Europe/London"),
        createZoomMeeting: true,
        audienceGroup: String(formData.get("audienceGroup") || "ALL") as "ALL" | "PK_UK" | "US_CA" | "AU",
        waitingRoom: formData.get("waitingRoom") === "on",
        joinBeforeHost: formData.get("joinBeforeHost") === "on",
        muteUponEntry: formData.get("muteUponEntry") === "on",
        autoRecording: String(formData.get("autoRecording") || "cloud") as "none" | "local" | "cloud",
        passcode: String(formData.get("passcode") || ""),
        showToStudents: formData.get("showToStudents") === "on",
      },
      teacherUserId,
    );

    revalidateLiveSessionViews();
    const shownToStudents = formData.get("showToStudents") === "on";
    return redirectTo(
      request,
      noticeHref(
        schedule.meetingUrl
          ? shownToStudents
            ? "Zoom live session created successfully. Matching students and parents have been notified."
            : "Internal Zoom live session created successfully. It will stay hidden from student and parent dashboards."
          : "Live session saved, but Zoom did not return a meeting link. Please check Zoom app scopes.",
        schedule.meetingUrl ? "success" : "error",
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request this Zoom session.";
    return redirectTo(request, noticeHref(message, "error"));
  }
}

async function deleteSession(request: NextRequest, formData: FormData, teacherUserId: string) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId: teacherUserId } });
  if (!teacher) return redirectTo(request, "/teacher-registration");

  const schedule = await db.classSchedule.findFirst({
    where: {
      id: String(formData.get("scheduleId") || ""),
      teacherId: teacher.id,
    },
  });

  if (schedule) {
    await db.classSchedule.delete({ where: { id: schedule.id } });
  }

  revalidateLiveSessionViews();
  return redirectTo(request, noticeHref("Live session removed successfully.", "success"));
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "TEACHER") {
    return redirectTo(request, "/auth/login");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create");

  if (intent === "delete") {
    return deleteSession(request, formData, session.user.id);
  }

  return createSession(request, formData, session.user.id);
}
