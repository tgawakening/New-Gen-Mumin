"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

const pageRefreshers = new Set<() => void>();
let pageRefreshTimer: number | null = null;

function subscribeToPageRefresh(refresh: () => void) {
  pageRefreshers.add(refresh);
  if (pageRefreshTimer === null) {
    pageRefreshTimer = window.setInterval(() => {
      if (document.hidden || !navigator.onLine) return;
      pageRefreshers.values().next().value?.();
    }, 30000 + Math.floor(Math.random() * 5000));
  }
  return () => {
    pageRefreshers.delete(refresh);
    if (!pageRefreshers.size && pageRefreshTimer !== null) {
      window.clearInterval(pageRefreshTimer);
      pageRefreshTimer = null;
    }
  };
}

function useClassRefresh(){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const inFlight=useRef(false);
  useEffect(()=>{if(!pending)inFlight.current=false;},[pending]);
  return useCallback(()=>{
    if(inFlight.current||document.hidden||!navigator.onLine)return;
    inFlight.current=true;
    startTransition(()=>router.refresh());
  },[router]);
}

export function LiveClassUpdates({ enabled }: { enabled: boolean }) {
  const refresh = useClassRefresh();
  useEffect(() => {
    if (!enabled) return;
    return subscribeToPageRefresh(refresh);
  }, [enabled, refresh]);
  return null;
}

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
  const refresh = useClassRefresh();
  const targetTime = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const [now, setNow] = useState(() => Date.now());
  const millisecondsUntilStart = targetTime - now;
  const canJoin = Boolean(meetingUrl) && !accessLocked && isLive;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Teachers may start early, reschedule, or create a class while this page is open.
  const shouldRefresh = Boolean(meetingUrl) && !accessLocked;
  useEffect(() => {
    if (!shouldRefresh) return;
    return subscribeToPageRefresh(refresh);
  }, [shouldRefresh, refresh]);

  return (
    <div className={`mt-4 rounded-[20px] border px-4 py-4 shadow-sm ${isLive ? "border-[#f4b85f] bg-[#102544]" : "border-white/10 bg-[#17243a]"}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">{isLive ? "Live now" : "Starts in"}</p>
      <p className="mt-1 text-3xl font-semibold text-white">{isLive ? "Class has started on Zoom" : formatCountdown(millisecondsUntilStart)}</p>
      {canJoin ? (
        <Link
          href={meetingUrl!}
          prefetch={false}
          target="_blank"
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#f4b85f] px-5 py-3 sm:w-auto text-sm font-bold text-[#102544] shadow-sm transition hover:bg-[#ffd082] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
