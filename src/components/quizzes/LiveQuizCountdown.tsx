"use client";

import { useEffect, useState } from "react";

type Props = {
  startedAt: string;
  durationSeconds?: number;
  serverNow?: string;
  dark?: boolean;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LiveQuizCountdown({ startedAt, durationSeconds = 60, serverNow, dark = false }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);

  useEffect(() => {
    const startedMs = new Date(startedAt).getTime();
    const serverNowMs = serverNow ? new Date(serverNow).getTime() : Date.now();
    const elapsedAtRender = Math.max(0, Math.floor((serverNowMs - startedMs) / 1000));
    const mountedAt = Date.now();
    const update = () => {
      const elapsedSinceMount = Math.floor((Date.now() - mountedAt) / 1000);
      setRemaining(Math.max(0, durationSeconds - elapsedAtRender - elapsedSinceMount));
    };
    update();
    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, [durationSeconds, serverNow, startedAt]);

  const percent = Math.max(0, Math.min(100, (remaining / durationSeconds) * 100));
  const urgent = remaining <= 10;
  return (
    <div className={`mt-4 rounded-2xl border p-4 ${dark ? "border-white/15 bg-white/10 text-white" : "border-[#eadfce] bg-white text-[#22304a]"}`} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Time remaining</span>
        <span className={`text-2xl font-bold tabular-nums ${urgent ? "text-[#ef4444]" : dark ? "text-[#f7c56f]" : "text-[#c27a2c]"}`}>{formatTime(remaining)}</span>
      </div>
      <div className={`mt-3 h-2 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-[#edf1f5]"}`}>
        <div className={`h-full rounded-full transition-[width] duration-300 ${urgent ? "bg-[#ef4444]" : "bg-[#f5a33b]"}`} style={{ width: `${percent}%` }} />
      </div>
      {remaining === 0 ? <p className="mt-2 text-sm font-semibold text-[#ef4444]">Time is complete. Please wait for the next question.</p> : null}
    </div>
  );
}