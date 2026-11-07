"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export function PresenceRefresh({ live, statusUrl }: { live: boolean; statusUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    let refreshing = false, completed = false;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible" || refreshing || completed) return;
      refreshing = true;
      try {
        const response = await fetch(statusUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json() as { openConnections: number; openMinutes: number };
        if (!result.openConnections) { completed = true; router.refresh(); }
        else setStatus(`${result.openConnections} open connections; ${result.openMinutes} minutes elapsed in open intervals (provisional).`);
      } catch { /* A temporary failure must not erase stored evidence. */ }
      finally { refreshing = false; }
    }, 30_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [live, router, statusUrl]);
  return <><button type="button" disabled={pending} onClick={() => start(() => router.refresh())} className="rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-50">{pending ? "Refreshing…" : "Refresh evidence"}</button>{status && <span role="status" className="text-xs text-slate-600">{status}</span>}</>;
}
