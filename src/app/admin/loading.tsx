export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="section-container py-12">
      <div className="rounded-2xl bg-white p-6 text-[#22304a] shadow-sm">
        <h1 className="text-xl font-semibold">Loading admin dashboard?</h1>
        <p className="mt-2 text-sm">Please wait while we load your dashboard.</p>
      </div>
    </div>
  );
}
