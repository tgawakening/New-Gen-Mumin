"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function storeBrowserCredential(email: string, password: string) {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  const credentialsApi = navigator.credentials as
    | (CredentialsContainer & {
        store?: (credential: Credential) => Promise<Credential | null>;
      })
    | undefined;
  const PasswordCredentialCtor = (window as Window & {
    PasswordCredential?: new (
      init: {
        id: string;
        password: string;
        name?: string;
      },
    ) => Credential;
  }).PasswordCredential as
    | (new (
        init: {
          id: string;
          password: string;
          name?: string;
        },
      ) => Credential)
    | undefined;

  if (!credentialsApi?.store || !PasswordCredentialCtor) return;

  try {
    const credential = new PasswordCredentialCtor({
      id: email,
      password,
      name: email,
    });
    await credentialsApi.store(credential);
  } catch {
    // Keep login flow non-blocking if the browser declines credential storage.
  }
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to log in.");
      }

      await storeBrowserCredential(email, password);
      setMessage("Login successful. Opening your dashboard...");
      router.push(payload.dashboardHome ?? "/parent");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to log in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5 rounded-[32px] bg-white p-8 shadow-sm" onSubmit={handleSubmit} autoComplete="on">
      <input name="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
      <input name="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="submit" disabled={isSubmitting} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
        <Link
          href="/auth/forgot-password"
          className="text-sm font-semibold text-[#334155] underline underline-offset-4"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
