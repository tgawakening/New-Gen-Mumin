"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function QabilaChatEnhancer() {
  const markerRef = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  useEffect(() => {
    const container = markerRef.current?.parentElement;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    let startX = 0;
    let startY = 0;
    const onStart = (event: TouchEvent) => {
      startX = event.touches[0]?.clientX || 0;
      startY = event.touches[0]?.clientY || 0;
    };
    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const message = (event.target as HTMLElement).closest<HTMLElement>("[data-reply-href]");
      if (!touch || !message) return;
      const horizontal = touch.clientX - startX;
      const vertical = Math.abs(touch.clientY - startY);
      if (horizontal > 70 && vertical < 55 && message.dataset.replyHref) router.push(message.dataset.replyHref);
    };
    container.addEventListener("touchstart", onStart, { passive: true });
    container.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onStart);
      container.removeEventListener("touchend", onEnd);
    };
  }, [router]);
  return <span ref={markerRef} className="sr-only">Swipe a message right to reply</span>;
}
