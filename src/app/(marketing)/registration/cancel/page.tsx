export default async function RegistrationCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="bg-[linear-gradient(180deg,#f8f2e7_0%,#fffdf9_48%,#f8f2e7_100%)] py-20">
      <div className="section-container">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#efe7d8] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Payment not completed</p>
          <h1 className="mt-4 text-4xl font-semibold text-[#22304a]">Your registration is still saved.</h1>
          <p className="mt-4 text-base leading-8 text-[#5f6b7a]">
            {params.gateway ? `The ${params.gateway.toUpperCase()} checkout was cancelled or interrupted.` : "The checkout was cancelled or interrupted."} You can return to the registration form and try again.
          </p>
        </div>
      </div>
    </div>
  );
}

