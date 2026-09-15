import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", release: "mumin-week-certificate-v2-remove", performance: "teacher-read-path-v1" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}