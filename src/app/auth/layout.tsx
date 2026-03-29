import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FDF6EF]">
      <header className="py-4">
        <div className="section-container">
          <Link href="/" className="text-orange-500 font-bold text-lg">
            ← Back to Gen-Mumins
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
