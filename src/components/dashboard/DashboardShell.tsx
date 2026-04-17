import Link from "next/link";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  role: string;
  items: readonly string[];
};

export function DashboardShell({
  title,
  subtitle,
  role,
  items,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="section-container py-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
            {role} workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-800">{title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{subtitle}</p>
        </div>
      </div>

      <div className="section-container grid gap-6 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-3xl bg-slate-900 p-6 text-white">
          <h2 className="text-lg font-semibold">Build Queue</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {items.map((item) => (
              <li key={item} className="rounded-2xl bg-white/10 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">Foundation Status</h2>
          <p className="mt-3 text-slate-600">
            This dashboard route is now wired into the LMS structure. The next
            step is connecting auth, database queries, and real feature modules.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auth/login"
              className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Open login flow
            </Link>
            <Link
              href="/registration"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Review public enrollment page
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
