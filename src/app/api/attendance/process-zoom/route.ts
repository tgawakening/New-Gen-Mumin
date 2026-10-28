import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processZoomAttendanceWork, seedZoomAttendanceDiscovery, zoomPresenceEnabled } from "@/lib/live-classes/zoom-attendance-work";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = env.success ? env.data.CRON_SECRET : undefined;
  const supplied = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!zoomPresenceEnabled()) return NextResponse.json({ error: "Zoom attendance pipeline is not enabled." }, { status: 503 });
  try {
    await seedZoomAttendanceDiscovery();
    const results: Awaited<ReturnType<typeof processZoomAttendanceWork>> = [];
    const started = Date.now();
    for (let batch = 0; batch < 8 && Date.now() - started < 40_000; batch++) {
      const processed = await processZoomAttendanceWork(4);
      results.push(...processed);
      if (!processed.length) break;
    }
    return NextResponse.json({ processed: results.length, successful: results.filter(row => row.ok).length, retrying: results.filter(row => !row.ok).length });
  } catch (error) { console.error("Zoom attendance processor failed", error); return NextResponse.json({ error: "Attendance processor failed. Inspect the admin queue and server logs." }, { status: 503 }); }
}
