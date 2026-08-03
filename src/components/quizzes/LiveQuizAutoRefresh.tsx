"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

type LiveQuizAutoRefreshProps = { intervalMs?: number; enabled?: boolean };

export function LiveQuizAutoRefresh({ intervalMs = 3200, enabled = true }: LiveQuizAutoRefreshProps) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    if (inFlight.current || document.hidden || !navigator.onLine) return;
    inFlight.current = true;
    startTransition(() => {
      router.refresh();
      window.setTimeout(() => { inFlight.current = false; }, 1200);
    });
  }, [router]);

  useEffect(() => {
    if (!enabled) return;
    const jitter = Math.floor(Math.random() * 900);
    const first = window.setTimeout(refresh, intervalMs + jitter);
    const id = window.setInterval(refresh, intervalMs + jitter);
    const resume = () => refresh();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
    };
  }, [enabled, intervalMs, refresh]);

  return null;
}
