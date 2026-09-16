"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="section-container py-12">
      <div className="rounded-2xl bg-white p-6 text-[#22304a] shadow-sm">
        <h1 className="text-xl font-semibold">We couldn?t load this admin page</h1>
        <p className="mt-2 text-sm">Please try again. If the problem continues, contact the administrator.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={reset} className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Try again</button>
          <a href="/admin/rewards" className="rounded-full border px-5 py-3 text-sm font-semibold">Open house points & rewards</a>
          <a href="/admin" className="rounded-full border px-5 py-3 text-sm font-semibold">Admin home</a>
        </div>
      </div>
    </div>
  );
}
