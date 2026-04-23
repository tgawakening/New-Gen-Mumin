import { NextResponse } from "next/server";

import { getExternalAdminOverview } from "@/lib/admin/dashboard";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  if (!env.success || !env.data.EXTERNAL_ADMIN_FEED_SECRET) {
    return NextResponse.json(
      { error: "External admin feed is not configured." },
      { status: 503 },
    );
  }

  const secret = request.headers.get("x-admin-feed-secret");
  if (secret !== env.data.EXTERNAL_ADMIN_FEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await getExternalAdminOverview();
  return NextResponse.json(overview);
}
