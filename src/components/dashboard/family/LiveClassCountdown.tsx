"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function formatCountdown(milliseconds: number) {
  if (milliseconds <= 0) return "Starting now";

  const totalMinutes = Math.ceil(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function LiveClassCountdown({
  startsAt,
  meetingUrl,
  accessLocked,
}: {
  startsAt: string;
  meetingUrl: string | null;
  accessLocked: boolean;
}) {
  const targetTime = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const [now, setNow] = useState(() => Date.now());
  const millisecondsUntilStart = targetTime - now;
  const canJoin = Boolean(meetingUrl) && !accessLocked && millisecondsUntilStart <= 15 * 60 * 1000;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mt-4 rounded-[20px] bg-white/10 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Starts in</p>
      <p className="mt-1 text-3xl font-semibold text-white">{formatCountdown(millisecondsUntilStart)}</p>
      {canJoin ? (
        <Link
          href={meetingUrl!}
          target="_blank"
          className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#22304a]"
        >
          Join Zoom class
        </Link>
      ) : meetingUrl && !accessLocked ? (
        <p className="mt-3 text-sm text-white/75">
          Join button opens 15 minutes before class.
        </p>
      ) : (
        <p className="mt-3 text-sm text-white/75">
          Zoom link appears after access is unlocked.
        </p>
      )}
    </div>
  );
}
