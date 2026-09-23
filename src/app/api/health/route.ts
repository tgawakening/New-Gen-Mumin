import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", release: "fast-join-recording-stream-v1", performance: "teacher-read-path-v1", qabilaMembershipRepair: "verified-test-siblings-v3", parentDashboard: "optional-sections-v1" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}