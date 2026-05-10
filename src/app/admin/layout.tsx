import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#edf2f6]">
      <div className="border-b border-[#dce4ed] bg-white">
        <div className="section-container flex items-center justify-between py-3">
          <Link
            href="/"
            className="rounded-full border border-[#d9e2eb] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f5f8fb]"
          >
            Main site
          </Link>
        </div>
      </div>
      <main>{children}</main>
    </div>
  );
}
