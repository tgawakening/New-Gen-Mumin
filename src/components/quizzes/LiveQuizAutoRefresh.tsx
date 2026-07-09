"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type LiveQuizAutoRefreshProps = {
  intervalMs?: number;
  enabled?: boolean;
};

export function LiveQuizAutoRefresh({ intervalMs = 2500, enabled = true }: LiveQuizAutoRefreshProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
