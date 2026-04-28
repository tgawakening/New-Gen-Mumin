"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FamilyLogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      className="cursor-pointer rounded-full border border-[#d9c7b1] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#fff7ef] disabled:opacity-60"
    >
      {isSubmitting ? "Logging out..." : "Logout"}
    </button>
  );
}
