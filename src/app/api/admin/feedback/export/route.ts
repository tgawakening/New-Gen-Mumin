import { NextRequest, NextResponse } from "next/server";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function personName(person?: { firstName: string; lastName: string | null; email?: string | null } | null) {
  if (!person) return "";
  return `${person.firstName} ${person.lastName ?? ""}`.trim() || person.email || "";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

function payloadValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.join(", ") : value ?? "";
}

function filenameFor(audience: FeedbackAudience | null) {
  const date = new Date().toISOString().slice(0, 10);
  if (audience === FeedbackAudience.PARENT) return `gen-m-parent-feedback-${date}.csv`;
  if (audience === FeedbackAudience.TEACHER) return `gen-m-teacher-feedback-${date}.csv`;
  return `gen-m-feedback-${date}.csv`;
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const audienceParam = request.nextUrl.searchParams.get("audience")?.toUpperCase();
  const audience = audienceParam === "PARENT" || audienceParam === "TEACHER" || audienceParam === "STUDENT"
    ? (audienceParam as FeedbackAudience)
    : null;

  const responses = await db.weeklyFeedbackResponse.findMany({
    where: audience ? { audience } : {},
    orderBy: { submittedAt: "desc" },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          enrollments: { include: { program: { select: { title: true } } } },
        },
      },
      submittedBy: { select: { firstName: true, lastName: true, email: true, role: true } },
    },
  });

  const headers = [
    "Audience",
    "Submitted At",
    "Week",
    "Parent/Teacher Name",
    "Parent/Teacher Email",
    "Student Name",
    "Student Email",
    "Programmes",
    "Mood/Satisfaction",
    "Confidence",
    "Workload",
    "Child Age Group",
    "Enjoying Classes",
    "Understanding Lessons",
    "Home Practice",
    "What Is Going Well",
    "Concern",
    "Improvement / Support Needed",
    "Contact Request",
  ];

  const rows = responses.map((entry) => {
    const programmes = Array.from(new Set(entry.student?.enrollments.map((enrollment) => displayProgramTitle(enrollment.program.title)) ?? []));
    return [
      entry.audience,
      formatDate(entry.submittedAt),
      entry.weekLabel,
      personName(entry.submittedBy),
      entry.submittedBy.email,
      personName(entry.student?.user),
      entry.student?.user.email ?? "",
      programmes.join(", ") || payloadValue(entry.rawPayload, "programmes"),
      entry.moodRating ?? payloadValue(entry.rawPayload, "satisfaction"),
      entry.confidence ?? payloadValue(entry.rawPayload, "confidence"),
      entry.workload ?? "",
      payloadValue(entry.rawPayload, "childAgeGroup"),
      payloadValue(entry.rawPayload, "enjoying"),
      payloadValue(entry.rawPayload, "understanding"),
      payloadValue(entry.rawPayload, "homePractice"),
      entry.wins ?? payloadValue(entry.rawPayload, "goingWell"),
      entry.concerns ?? payloadValue(entry.rawPayload, "concern"),
      entry.supportNeeded ?? payloadValue(entry.rawPayload, "improvement"),
      payloadValue(entry.rawPayload, "contactRequest"),
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameFor(audience)}"`,
      "Cache-Control": "no-store",
    },
  });
}