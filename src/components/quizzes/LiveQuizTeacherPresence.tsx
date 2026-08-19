"use client";

import { useEffect } from "react";

export function LiveQuizTeacherPresence({ sessionId, enabled }: { sessionId: string; enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const heartbeat = () => {
      if (!navigator.onLine) return;
      void fetch(`/api/quizzes/live/${sessionId}/heartbeat`, { method: "POST", cache: "no-store", keepalive: true });
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, 10_000);
    const resume = () => { if (!document.hidden) heartbeat(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", heartbeat);
    window.addEventListener("online", heartbeat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", heartbeat);
      window.removeEventListener("online", heartbeat);
    };
  }, [enabled, sessionId]);
  return null;
}
