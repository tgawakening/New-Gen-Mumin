"use client";

import { useMemo, useState } from "react";

import { REGISTRATION_COUNTRIES } from "@/lib/registration/catalog";

const SPECIALTY_OPTIONS = [
  "Seerah",
  "Life Lessons & Leadership",
  "Arabic",
  "Qur'anic Tajweed",
  "Assessment & Reporting",
  "Homework Coaching",
];

export function TeacherSignupForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneCountryCode: "+44",
    phoneNumber: "",
    timezone: "Europe/London",
    bio: "",
    specialties: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordHint = useMemo(() => {
    if (!form.password) return null;
    if (form.password.length < 8) return "Password should contain at least 8 characters.";
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      return "Use a stronger password with a capital letter and a number.";
    }
    return "Strong password.";
  }, [form.password]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/teacher-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create teacher account.");
      }

      setMessage("Teacher account created successfully. Your teaching dashboard is ready.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to create teacher account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6 rounded-[32px] border border-[#eadfce] bg-white p-8 shadow-sm" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="First name"
          value={form.firstName}
          onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
        />
        <Field
          label="Last name"
          value={form.lastName}
          onChange={(value) => setForm((current) => ({ ...current, lastName: value }))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Email address"
          type="email"
          value={form.email}
          onChange={(value) => setForm((current) => ({ ...current, email: value }))}
        />
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#22304a]">Timezone</label>
          <select
            value={form.timezone}
            onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
            className="w-full rounded-2xl border border-[#d6c5ae] bg-[#fffdf8] px-4 py-3 text-sm text-[#22304a] outline-none"
          >
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Karachi">Asia/Karachi</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PasswordField
          label="Create password"
          value={form.password}
          onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          hint={passwordHint}
        />
        <PasswordField
          label="Confirm password"
          value={form.confirmPassword}
          onChange={(value) => setForm((current) => ({ ...current, confirmPassword: value }))}
          hint={
            !form.confirmPassword
              ? null
              : form.confirmPassword === form.password
                ? "Password match confirmed."
                : "Passwords do not match."
          }
          success={!!form.confirmPassword && form.confirmPassword === form.password}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#22304a]">Country code</label>
          <select
            value={form.phoneCountryCode}
            onChange={(event) =>
              setForm((current) => ({ ...current, phoneCountryCode: event.target.value }))
            }
            className="w-full rounded-2xl border border-[#d6c5ae] bg-[#fffdf8] px-4 py-3 text-sm text-[#22304a] outline-none"
          >
            {REGISTRATION_COUNTRIES.map((country) => (
              <option key={country.code} value={country.code === "GB" ? "+44" : country.code === "PK" ? "+92" : country.code === "US" ? "+1" : country.code === "AE" ? "+971" : country.code === "SA" ? "+966" : country.code === "IN" ? "+91" : country.code === "BD" ? "+880" : country.code === "AF" ? "+93" : "+44"}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Phone number"
          value={form.phoneNumber}
          onChange={(value) => setForm((current) => ({ ...current, phoneNumber: value }))}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-[#22304a]">Teaching bio</label>
        <textarea
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
          rows={4}
          className="w-full rounded-2xl border border-[#d6c5ae] bg-[#fffdf8] px-4 py-3 text-sm text-[#22304a] outline-none"
          placeholder="Share the teaching background, audience fit, and programme strengths."
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-[#22304a]">Specialties</label>
        <div className="flex flex-wrap gap-3">
          {SPECIALTY_OPTIONS.map((specialty) => {
            const active = form.specialties.includes(specialty);
            return (
              <button
                key={specialty}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[#22304a] text-white"
                    : "border border-[#dcccb6] bg-[#fff8ef] text-[#4f5d71]"
                }`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    specialties: active
                      ? current.specialties.filter((entry) => entry !== specialty)
                      : [...current.specialties, specialty],
                  }))
                }
              >
                {specialty}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-[#f39f5f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#e07e2b] disabled:opacity-60"
      >
        {isSubmitting ? "Creating teacher account..." : "Create teacher account"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[#22304a]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[#d6c5ae] bg-[#fffdf8] px-4 py-3 text-sm text-[#22304a] outline-none"
        required
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  hint,
  success = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string | null;
  success?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[#22304a]">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-[#d6c5ae] bg-[#fffdf8] px-4 py-3 pr-14 text-sm text-[#22304a] outline-none"
          minLength={8}
          autoComplete="new-password"
          required
        />
        <button
          type="button"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#526074]"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "View"}
        </button>
      </div>
      {hint ? (
        <p className={`text-xs ${success ? "text-emerald-600" : hint.includes("match") || hint.includes("Strong") ? "text-emerald-600" : "text-rose-600"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
