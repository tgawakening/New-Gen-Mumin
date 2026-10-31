"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const LiveClassContext = createContext(false);

export function TeacherLiveClassProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let controller: AbortController | undefined;
    let disposed = false;
    async function refresh() {
      if (document.hidden || controller) return;
      controller = new AbortController();
      const request = controller;
      const timeout = window.setTimeout(() => request.abort(), 8000);
      try {
        const response = await fetch("/api/teacher/live-rewards", { cache: "no-store", signal: request.signal });
        if (!response.ok) { if (!disposed) setLive(false); return; }
        const data = await response.json() as { live?: boolean };
        if (!disposed) setLive(data.live === true);
      } catch { if (!disposed) setLive(false); }
      finally { window.clearTimeout(timeout); controller = undefined; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { disposed = true; window.clearInterval(timer); controller?.abort(); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);
  return <LiveClassContext.Provider value={live}>{children}</LiveClassContext.Provider>;
}

export function TeacherLiveRewardBadge({ fallback = null }: { fallback?: ReactNode }) {
  const live = useContext(LiveClassContext);
  if (!live) return fallback;
  return <span role="status" aria-label="Your class is live. Award badges and points." className="absolute -right-1 -top-2 rounded-full bg-[#dc3434] px-2 py-1 text-[10px] font-bold leading-none text-white shadow-md">LIVE</span>;
}
