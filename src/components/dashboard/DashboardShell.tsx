import Link from "next/link";
import { ReactNode } from "react";

type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
};

type DashboardNavItem = {
  label: string;
  href: string;
  badge?: string;
};

type DashboardPanel = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: readonly string[];
};

type DashboardShellProps = {
  title: string;
  subtitle: string;
  role: string;
  accentLabel: string;
  metrics: readonly DashboardMetric[];
  navItems: readonly DashboardNavItem[];
  panels: readonly DashboardPanel[];
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  children?: ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  role,
  accentLabel,
  metrics,
  navItems,
  panels,
  primaryCta,
  secondaryCta,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      <div className="border-b border-[#e8dccf] bg-[linear-gradient(180deg,#fff8f0_0%,#fffdf9_100%)]">
        <div className="section-container py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
            {role} Workspace
          </p>
          <div className="mt-3 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <h1 className="text-4xl font-semibold tracking-tight text-[#22304a]">{title}</h1>
              <p className="mt-3 text-base leading-8 text-[#5f6b7a]">{subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {primaryCta ? (
                <Link
                  href={primaryCta.href}
                  className="rounded-full bg-[#f39f5f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
                >
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className="rounded-full border border-[#d9c7b1] bg-white px-5 py-3 text-sm font-semibold text-[#22304a] transition hover:bg-[#fff7ef]"
                >
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="section-container grid gap-6 py-8 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-[28px] bg-[#22304a] p-6 text-white shadow-[0_20px_50px_rgba(34,48,74,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f2c58f]">{accentLabel}</p>
            <h2 className="mt-3 text-2xl font-semibold">Dashboard map</h2>
            <div className="mt-5 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/90 transition hover:bg-white/12"
                >
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-[#f39f5f] px-2.5 py-1 text-[11px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
                <p className="text-sm text-[#6d7785]">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold text-[#22304a]">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-[#8a94a3]">{metric.hint}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            {panels.map((panel) => (
              <div key={panel.title} className="rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">{panel.eyebrow}</p>
                <h3 className="mt-3 text-2xl font-semibold text-[#22304a]">{panel.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{panel.description}</p>
                <ul className="mt-5 space-y-3">
                  {panel.bullets.map((bullet) => (
                    <li key={bullet} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm leading-6 text-[#4d5a6b]">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {children}
        </div>
      </div>
    </div>
  );
}
