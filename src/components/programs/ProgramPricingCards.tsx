import Link from "next/link";
import type { ProgramPriceCard } from "@/lib/program-content";

type ProgramPricingCardsProps = {
  title: string;
  cards: ProgramPriceCard[];
};

function PriceRow({
  originalPrice,
  discountedPrice,
  frequency,
}: {
  originalPrice: string;
  discountedPrice: string;
  frequency: string;
}) {
  return (
    <div className="mt-3 flex items-end gap-2">
      <span className="text-base text-white/70 line-through">{originalPrice}</span>
      <span className="text-3xl font-bold text-white">{discountedPrice}</span>
      <span className="pb-1 text-sm text-white/90">{frequency}</span>
    </div>
  );
}

export function ProgramPricingCards({ title, cards }: ProgramPricingCardsProps) {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="section-container">
        <h2 className="font-serif text-3xl font-bold text-[#334155] md:text-4xl">{title}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.title} className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-orange-100">
              <div className="p-6">
                <h3 className="font-heading text-xl font-bold text-[#334155]">{card.title}</h3>
                <p className="mt-1 min-h-12 text-sm text-[#64748b]">{card.subtitle}</p>
              </div>

              <div className="bg-kidsa-oragne-500 px-6 py-4">
                <PriceRow
                  originalPrice={card.originalPrice}
                  discountedPrice={card.discountedPrice}
                  frequency={card.frequency}
                />
              </div>

              <div className="p-6">
                <ul className="space-y-2 text-sm text-[#475569]">
                  {card.bullets.map((bullet) => (
                    <li key={bullet}>- {bullet}</li>
                  ))}
                </ul>
                <Link
                  href={card.href}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#6B5B95] px-4 py-3 font-semibold text-white transition hover:bg-[#5b4d85]"
                >
                  View Program
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
