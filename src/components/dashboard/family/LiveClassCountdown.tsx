"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  isLive = false,
}: {
  startsAt: string;
  meetingUrl: string | null;
  accessLocked: boolean;
  isLive?: boolean;
}) {
  const router = useRouter();
  const targetTime = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const [now, setNow] = useState(() => Date.now());
  const millisecondsUntilStart = targetTime - now;
  const canJoin = Boolean(meetingUrl) && !accessLocked && isLive;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (millisecondsUntilStart > 15 * 60 * 1000 || millisecondsUntilStart < -6 * 60 * 60 * 1000) return;
    const interval = window.setInterval(() => router.refresh(), 30000);
    return () => window.clearInterval(interval);
  }, [isLive, millisecondsUntilStart, router]);

  return (
    <div className={`mt-4 rounded-[20px] border px-4 py-4 shadow-sm ${isLive ? "border-[#f4b85f] bg-[#102544]" : "border-white/10 bg-[#17243a]"}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">{isLive ? "Live now" : "Starts in"}</p>
      <p className="mt-1 text-3xl font-semibold text-white">{isLive ? "Class has started on Zoom" : formatCountdown(millisecondsUntilStart)}</p>
      {canJoin ? (
        <Link
          href={meetingUrl!}
          target="_blank"
          className="mt-4 inline-flex rounded-full bg-[#f4b85f] px-4 py-2 text-sm font-bold text-[#102544] shadow-sm transition hover:bg-[#ffd082] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Join now
        </Link>
      ) : meetingUrl && !accessLocked ? (
        <p className="mt-3 text-sm text-white/75">
          Join now will appear as soon as the teacher starts this class on Zoom.
        </p>
      ) : (
        <p className="mt-3 text-sm text-white/75">
          Zoom link appears after access is unlocked.
        </p>
      )}
    </div>
  );
}
