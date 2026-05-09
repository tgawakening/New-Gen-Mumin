import "server-only";

import { env } from "@/lib/env";

type ZoomMeetingPayload = {
  topic: string;
  agenda?: string;
  timezone: string;
  startTime: string;
  durationMinutes: number;
  weekday: number;
};

type ZoomMeetingResponse = {
  id: number;
  join_url: string;
  start_url?: string;
};

function getZoomConfig() {
  if (!env.success) {
    throw new Error("Application environment is not configured.");
  }

  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_HOST_USER_ID } = env.data;

  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET || !ZOOM_HOST_USER_ID) {
    throw new Error("Zoom environment variables are missing.");
  }

  return {
    accountId: ZOOM_ACCOUNT_ID,
    clientId: ZOOM_CLIENT_ID,
    clientSecret: ZOOM_CLIENT_SECRET,
    hostUserId: ZOOM_HOST_USER_ID,
  };
}

async function getZoomAccessToken() {
  const config = getZoomConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", config.accountId);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zoom token request failed: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Zoom token response did not include an access token.");
  }

  return payload.access_token;
}

function toZoomWeeklyDay(weekday: number) {
  return String(weekday + 1);
}

export function isZoomConfigured() {
  return (
    env.success &&
    Boolean(
      env.data.ZOOM_ACCOUNT_ID &&
        env.data.ZOOM_CLIENT_ID &&
        env.data.ZOOM_CLIENT_SECRET &&
        env.data.ZOOM_HOST_USER_ID,
    )
  );
}

export async function createRecurringZoomMeeting(payload: ZoomMeetingPayload) {
  const config = getZoomConfig();
  const accessToken = await getZoomAccessToken();
  const response = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(config.hostUserId)}/meetings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: payload.topic,
        type: 8,
        start_time: payload.startTime,
        duration: payload.durationMinutes,
        timezone: payload.timezone,
        agenda: payload.agenda,
        recurrence: {
          type: 2,
          repeat_interval: 1,
          weekly_days: toZoomWeeklyDay(payload.weekday),
        },
        settings: {
          join_before_host: false,
          waiting_room: true,
          approval_type: 2,
          registration_type: 1,
          mute_upon_entry: true,
          auto_recording: "cloud",
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zoom meeting creation failed: ${body || response.statusText}`);
  }

  return (await response.json()) as ZoomMeetingResponse;
}
