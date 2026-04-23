import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-[60vh] bg-[#FDF6EF] py-16">
      <div className="section-container max-w-2xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">Parent Onboarding</p>
          <h1 className="mt-3 text-4xl font-bold text-[#334155]">Create your parent account</h1>
          <p className="mt-4 text-lg text-[#64748b]">
            This creates the account layer for the LMS so registration drafts, payment history, renewals, and the parent dashboard can connect to the same profile.
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
