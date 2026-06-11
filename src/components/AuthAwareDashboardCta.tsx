"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type AuthAwareDashboardCtaProps = {
  className?: string;
  loggedOutLabel?: string;
  loggedInLabel?: string;
  onClick?: () => void;
  iconClassName?: string;
};

export function AuthAwareDashboardCta({
  className = "theme-btn",
  loggedOutLabel = "Enroll Now",
  loggedInLabel = "Your Dashboard",
  onClick,
  iconClassName = "h-4 w-4",
}: AuthAwareDashboardCtaProps) {
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!isMounted) return;
        setDashboardHref(payload.authenticated && payload.dashboardHome ? payload.dashboardHome : null);
      })
      .catch(() => {
        if (!isMounted) return;
        setDashboardHref(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Link href={dashboardHref ?? "/registration"} onClick={onClick} className={className}>
      <span>{dashboardHref ? loggedInLabel : loggedOutLabel}</span>
      <ArrowRight className={iconClassName} aria-hidden />
    </Link>
  );
}
