import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/config";

/** Dark teal CTA - Join the Gen Mu'mins Movement (live-09). */
export function JoinMovementSection() {
  return (
    <section className="relative py-16 md:py-20 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-700" />
      <div className="absolute inset-0 opacity-90" style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #134e4a 100%)" }} />
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-black/10" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-2xl">
          <p className="text-white/90 text-lg mb-2">Raising the leaders of tomorrow with faith</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-8">
            Join the Gen Mu&apos;mins Movement
          </h2>
          <a
            href={SITE.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-[#334155] hover:bg-gray-100 font-bold py-4 px-8 rounded-full transition-all shadow-lg"
          >
            Join Our Community
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </div>
    </section>
  );
}
