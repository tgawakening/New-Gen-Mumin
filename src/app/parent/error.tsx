"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ParentError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Parent route error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f7f2ea] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[#d9c9a2] bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-[#22304a]">Something went wrong</h1>
        <p className="mt-4 text-sm leading-7 text-[#5f6b7a]">
          We could not load your parent dashboard right now. Please try again or contact support if the issue persists.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17243a]"
          >
            Retry
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-[#22304a] px-5 py-2.5 text-sm font-semibold text-[#22304a] transition hover:bg-[#f7f2ea]"
          >
            Go to main site
          </Link>
        </div>
      </div>
    </div>
  );
}
