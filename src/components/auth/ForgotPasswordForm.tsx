"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send reset email.");
      }

      setMessage(
        payload.message ??
          "If this email is registered, a password reset link has been sent.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to send reset email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-5 rounded-[32px] bg-white p-8 shadow-sm"
      onSubmit={handleSubmit}
      autoComplete="on"
    >
      <input
        name="email"
        autoComplete="email"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
        required
      />
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
        <Link
          href="/auth/login"
          className="text-sm font-semibold text-[#334155] underline underline-offset-4"
        >
          Back to login
        </Link>
      </div>
    </form>
  );
}
