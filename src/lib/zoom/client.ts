import "server-only";

import { env } from "@/lib/env";

type ZoomMeetingPayload = {
  topic: string;
  agenda?: string;
  timezone: string;
  startTime: string;
  durationMinutes: number;
  weekday: number;
  waitingRoom?: boolean;
  joinBeforeHost?: boolean;
  muteUponEntry?: boolean;
  autoRecording?: "none" | "local" | "cloud";
  passcode?: string;
  alternativeHosts?: string[];
};

type ZoomMeetingResponse = {
  id: number;
  join_url: string;
  start_url?: string;
};

type ZoomMeetingDetailsResponse = {
  id: number;
  join_url?: string;
  start_url?: string;
};

async function readZoomError(response: Response) {
  const body = await response.text();
  if (!body) return `${response.status} ${response.statusText}`.trim();

  try {
    const payload = JSON.parse(body) as { message?: string; error?: string; reason?: string; code?: number };
    return [payload.message, payload.error, payload.reason, payload.code ? `code ${payload.code}` : null]
      .filter(Boolean)
      .join(" - ");
  } catch {
    return body;
  }
}

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
    const details = await readZoomError(response);
    throw new Error(`Zoom token request failed: ${details}`);
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
          join_before_host: payload.joinBeforeHost ?? false,
          waiting_room: payload.waitingRoom ?? true,
          approval_type: 2,
          registration_type: 1,
          mute_upon_entry: payload.muteUponEntry ?? true,
          auto_recording: payload.autoRecording ?? "cloud",
          password: payload.passcode || undefined,
          alternative_hosts: payload.alternativeHosts?.filter(Boolean).join(",") || undefined,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await readZoomError(response);
    const guidance =
      response.status === 401
        ? " Check that the Zoom app is Server-to-Server OAuth, is activated, has scopes meeting:write:meeting and meeting:write:meeting:admin, and that ZOOM_HOST_USER_ID belongs to the same Zoom account."
        : "";
    throw new Error(`Zoom meeting creation failed: ${details}.${guidance}`);
  }

  return (await response.json()) as ZoomMeetingResponse;
}

export async function getZoomMeetingStartUrl(meetingId: string) {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await readZoomError(response);
    const guidance =
      response.status === 401 || response.status === 403
        ? " Check that the Zoom app has meeting:read:meeting and meeting:read:meeting:admin scopes and has been re-activated after adding scopes."
        : "";
    throw new Error(`Zoom meeting start link failed: ${details}.${guidance}`);
  }

  const meeting = (await response.json()) as ZoomMeetingDetailsResponse;
  if (!meeting.start_url) {
    throw new Error("Zoom did not return a teacher start link for this meeting.");
  }

  return meeting.start_url;
}

export async function downloadZoomRecording(downloadUrl: string) {
  const accessToken = await getZoomAccessToken();
  const fetchRecording = (url: string, withBearer: boolean) => fetch(url, {
    method: "GET",
    headers: withBearer ? { Authorization: `Bearer ${accessToken}` } : undefined,
    cache: "no-store",
  });

  let response = await fetchRecording(downloadUrl, true);
  if (!response.ok) {
    const tokenUrl = new URL(downloadUrl);
    tokenUrl.searchParams.set("access_token", accessToken);
    response = await fetchRecording(tokenUrl.toString(), false);
  }

  if (!response.ok) {
    const details = await readZoomError(response);
    const guidance =
      response.status === 401 || response.status === 403
        ? " Check that the Zoom Server-to-Server OAuth app has cloud recording read scopes and was re-activated after scope changes."
        : "";
    throw new Error(`Zoom recording download failed: ${details}.${guidance}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") ?? "video/mp4",
  };
}
