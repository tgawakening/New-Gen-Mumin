"use client";

import { useState } from "react";

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
    // Keep signup flow non-blocking if the browser declines credential storage.
  }
}

export function SignupForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneCountryCode: "+44",
    phoneNumber: "",
    billingCountryCode: "GB",
    billingCountryName: "United Kingdom",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create account.");
      }

      await storeBrowserCredential(form.email, form.password);
      setMessage("Parent account created successfully. You can now continue with enrollment.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5 rounded-[32px] bg-white p-8 shadow-sm" onSubmit={handleSubmit} autoComplete="on">
      <div className="grid gap-4 md:grid-cols-2">
        <input name="given-name" autoComplete="given-name" placeholder="First name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" required />
        <input name="family-name" autoComplete="family-name" placeholder="Last name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" required />
      </div>
      <input name="email" autoComplete="email" type="email" placeholder="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
      <input name="new-password" autoComplete="new-password" type="password" placeholder="Password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
      <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
        <input name="tel-country-code" autoComplete="tel-country-code" placeholder="Code" value={form.phoneCountryCode} onChange={(event) => setForm((current) => ({ ...current, phoneCountryCode: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" required />
        <input name="tel" autoComplete="tel" placeholder="Phone number" value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" required />
      </div>
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <button type="submit" disabled={isSubmitting} className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {isSubmitting ? "Creating account..." : "Create parent account"}
      </button>
    </form>
  );
}
