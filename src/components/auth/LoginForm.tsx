"use client";

import Link from "next/link";
import { useState } from "react";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      action="/api/auth/login/form"
      method="post"
      className="mx-auto w-full max-w-md space-y-5 rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8"
      onSubmit={() => setIsSubmitting(true)}
      autoComplete="on"
    >
      <input name="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" placeholder="Email" className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
      <div className="relative">
        <input name="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" type={showPassword ? "text" : "password"} placeholder="Password" className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-20" required />
        <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold text-[#334155]">{showPassword ? "Hide" : "Show"}</button>
      </div>
      {initialError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{initialError}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="submit" disabled={isSubmitting} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Connecting..." : "Log in"}</button>
        <Link href="/auth/forgot-password" className="text-sm font-semibold text-[#334155] underline underline-offset-4">Forgot password?</Link>
      </div>
    </form>
  );
}