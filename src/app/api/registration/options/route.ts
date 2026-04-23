import { NextResponse } from "next/server";

import { getRegistrationOptions } from "@/lib/registration/service";

export async function GET() {
  try {
    const options = await getRegistrationOptions();
    return NextResponse.json(options);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load registration options.",
      },
      { status: 500 },
    );
  }
}
