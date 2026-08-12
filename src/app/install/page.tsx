import Link from "next/link";

import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-[#17243a] px-5 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-semibold text-[#f2c58f]">Back to Gen-Mumin</Link>
        <p className="mt-12 text-xs font-semibold uppercase tracking-[0.18em] text-[#f2c58f]">Quick access</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Install the Gen-Mumin app</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">Keep the parent, student, or teacher dashboard on your home screen for faster access to classes, recordings, and learning tools.</p>
        <PwaInstallPrompt force />
      </div>
    </main>
  );
}
