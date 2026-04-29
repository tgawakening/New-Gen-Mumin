"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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
    // Do not block password reset if the browser declines credential storage.
  }
}

function getPasswordStrength(password: string) {
  if (!password) {
    return {
      tone: "text-[#657284]",
      message:
        "Use at least 8 characters. A mix of letters, numbers, and symbols makes it stronger.",
    };
  }

  if (password.length < 8) {
    return {
      tone: "text-[#b24c4c]",
      message: "Password must contain at least 8 characters.",
    };
  }

  const checks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (checks >= 3) {
    return {
      tone: "text-[#2f6b4b]",
      message:
        "Strong password. Keep using a mix of letters, numbers, and symbols.",
    };
  }

  return {
    tone: "text-[#8a6326]",
    message:
      "Password is valid, but adding numbers, capitals, or symbols will make it stronger.",
  };
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordStrength = useMemo(
    () => getPasswordStrength(password),
    [password],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reset password.");
      }

      if (email.trim()) {
        await storeBrowserCredential(email.trim(), password);
      }

      setMessage(
        payload.message ?? "Your password has been updated. You can now log in.",
      );

      setTimeout(() => {
        router.push("/auth/login");
      }, 1200);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to reset password.",
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
        placeholder="Email used for your account"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
      />
      <div>
        <div className="relative">
          <input
            name="password"
            autoComplete="new-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            spellCheck={false}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12"
            placeholder="New password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6f7f92]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className={`mt-2 text-xs font-medium ${passwordStrength.tone}`}>
          {passwordStrength.message}
        </p>
      </div>
      <div>
        <div className="relative">
          <input
            name="password-confirmation"
            autoComplete="new-password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            spellCheck={false}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12"
            placeholder="Confirm password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6f7f92]"
            aria-label={
              showConfirmPassword ? "Hide confirm password" : "Show confirm password"
            }
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {confirmPassword ? (
          <p
            className={`mt-2 text-xs font-medium ${
              password === confirmPassword && password.length >= 8
                ? "text-[#2f6b4b]"
                : "text-[#b24c4c]"
            }`}
          >
            {password === confirmPassword
              ? password.length >= 8
                ? "Passwords match."
                : "Password still needs at least 8 characters."
              : "Passwords do not match."}
          </p>
        ) : null}
      </div>
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
          {isSubmitting ? "Resetting..." : "Save new password"}
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
