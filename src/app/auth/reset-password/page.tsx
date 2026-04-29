import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

type PageProps = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const token = params?.token ?? "";

  return (
    <div className="min-h-[60vh] bg-[#FDF6EF] py-16">
      <div className="section-container max-w-2xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
            Password Recovery
          </p>
          <h1 className="mt-3 text-4xl font-bold text-[#334155]">
            Choose a new password
          </h1>
          <p className="mt-4 text-lg text-[#64748b]">
            Set a fresh password for your Gen-Mumins dashboard, then log back
            in and let your browser save it if you want.
          </p>
        </div>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="rounded-[32px] bg-white p-8 shadow-sm">
            <p className="text-sm leading-7 text-rose-600">
              This reset link is missing its secure token. Please request a new
              password reset email.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
