"use client";
import { useEffect } from "react";

export function HomeworkReviewFocus() {
  useEffect(() => {
    const openReview = () => {
      if (!window.location.hash.startsWith("#homework-")) return;
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const section = document.getElementById(id);
      if (section instanceof HTMLDetailsElement) {
        section.open = true;
        section.scrollIntoView({ block: "start" });
      }
    };
    openReview();
    window.addEventListener("hashchange", openReview);
    return () => window.removeEventListener("hashchange", openReview);
  }, []);
  return null;
}
