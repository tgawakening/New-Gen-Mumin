import Link from "next/link";
export default function Loading() {
 return <main className="min-h-screen bg-[#f7f2ea] p-6"><div className="mx-auto max-w-xl space-y-4 rounded-3xl bg-white p-6"><h1 className="text-xl font-semibold">Opening your teacher portal...</h1><p role="status">Loading your classes and dashboard.</p><Link prefetch={false} href="/teacher/live-sessions" className="inline-flex rounded-xl bg-[#22304a] px-4 py-3 text-white">Open live sessions</Link></div></main>;
}
