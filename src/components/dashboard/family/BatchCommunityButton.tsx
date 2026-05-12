"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { SITE } from "@/lib/config";

const STORAGE_KEY = "genmumin.batch1CommunityClicked";

export function BatchCommunityButton() {
  const [hasClicked, setHasClicked] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasClicked(window.localStorage.getItem(STORAGE_KEY) === "1");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleClick() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setHasClicked(true);
  }

  return (
    <a
      href={SITE.batchOneCommunity.href}
      target="_blank"
      rel="noreferrer"
      title="Batch-1 Gen-Mumin WhatsApp community"
      onClick={handleClick}
      className={`group/community relative inline-flex items-center gap-2 rounded-full border border-[#cfe8d4] bg-[#eafaf0] px-4 py-2 text-sm font-semibold text-[#126b32] shadow-sm transition hover:bg-[#d9f5e3] ${
        hasClicked ? "" : "animate-pulse ring-2 ring-[#25d366]/40"
      }`}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Join Batch-1</span>
      <span className="sr-only">{SITE.batchOneCommunity.label}</span>
      <span className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-50 hidden w-56 rounded-2xl bg-[#123322] px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-xl transition group-hover/community:block group-hover/community:opacity-100">
        Join Batch-1 Gen-Mumin WhatsApp community
      </span>
    </a>
  );
}
