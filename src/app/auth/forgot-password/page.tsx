import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[60vh] bg-[#FDF6EF] py-16">
      <div className="section-container max-w-2xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
            Password Recovery
          </p>
          <h1 className="mt-3 text-4xl font-bold text-[#334155]">
            Reset your dashboard password
          </h1>
          <p className="mt-4 text-lg text-[#64748b]">
            Enter your email and we&apos;ll send you a secure link to choose a
            new password for your Gen-Mumins dashboard.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
