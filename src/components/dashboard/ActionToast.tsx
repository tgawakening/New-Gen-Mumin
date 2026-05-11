"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function ActionToast({ message, tone = "success" }: { message?: string; tone?: string }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message || !visible) return null;

  const error = tone === "error" || tone === "danger";
  const Icon = error ? XCircle : CheckCircle2;

  return (
    <div className="fixed right-4 top-4 z-[100] w-[min(420px,calc(100vw-2rem))]">
      <div
        className={`flex items-start gap-3 rounded-[20px] border px-4 py-4 text-sm font-semibold shadow-2xl ${
          error
            ? "border-[#efb3b3] bg-[#fff4f4] text-[#a23c3c]"
            : "border-[#bfe4ca] bg-[#effaf3] text-[#2f6b4b]"
        }`}
      >
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="leading-6">{message}</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-auto rounded-full px-2 text-lg leading-none opacity-70 transition hover:opacity-100"
          aria-label="Dismiss notification"
        >
          x
        </button>
      </div>
    </div>
  );
}
