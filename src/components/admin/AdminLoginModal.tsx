"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginModal() {
  const router = useRouter();
  const [email, setEmail] = useState("tgawakening786@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to log in.");
      }

      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to log in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-[#22304a]/45 px-4 py-6">
      <div className="w-full max-w-[460px] rounded-[30px] border border-[#eadfce] bg-[#fffaf5] p-8 shadow-[0_30px_70px_rgba(34,48,74,0.24)]">
        <p className="inline-flex rounded-full bg-[#f39f5f] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
          Admin dashboard
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-[#22304a]">Admin login</h1>
        <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">
          Enter the Gen-Mumin admin dashboard credentials to open the operations workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          <Field label="Password" type="password" value={password} onChange={setPassword} />
          {error ? (
            <div className="rounded-2xl border border-[#f0cccc] bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#182236] disabled:opacity-60"
          >
            {isSubmitting ? "Opening dashboard..." : "Open admin dashboard"}
          </button>
        </form>
      </div>
    </div>
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
        className="w-full rounded-2xl border border-[#d9cbb8] bg-white px-4 py-3 text-sm text-[#22304a] outline-none"
        required
      />
    </div>
  );
}
