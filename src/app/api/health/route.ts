import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", release: "certificate-png-safe-assets-v1", performance: "teacher-read-path-v1" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}