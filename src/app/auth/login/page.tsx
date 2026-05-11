import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-[70vh] bg-[#FDF6EF] py-16">
      <div className="section-container">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">Family & Teacher Access</p>
          <h1 className="mt-3 text-4xl font-bold text-[#334155]">Log in to continue</h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#64748b]">
            Use your parent or teacher account to review registration drafts, continue payment, open the family dashboard, or publish course content from the teacher workspace.
          </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
