import { loginPayloadSchema } from "@/lib/auth/schema";
import { getDashboardHome } from "@/lib/auth/session";
import { loginAccount } from "@/lib/auth/service";

function seeOther(location: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload = loginPayloadSchema.parse({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    const user = await loginAccount(payload);
    return seeOther(getDashboardHome(user.role));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in.";
    const temporary = /database|connect|timeout|fetch|pool|unavailable/i.test(message);
    const params = new URLSearchParams({
      error: temporary ? "The login service is busy. Please try again." : message,
    });
    return seeOther(`/auth/login?${params.toString()}`);
  }
}