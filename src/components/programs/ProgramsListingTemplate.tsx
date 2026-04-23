import Link from "next/link";
import type { ProgramsListingContent } from "@/lib/program-content";
import { InnerHeader } from "./InnerHeader";
import { ProgramPricingCards } from "./ProgramPricingCards";

type ProgramsListingTemplateProps = {
  content: ProgramsListingContent;
};

export function ProgramsListingTemplate({ content }: ProgramsListingTemplateProps) {
  const { bundle } = content;

  return (
    <div className="bg-[#FDF6EF]">
      <InnerHeader title={content.title} breadcrumbLabel={content.title} />

      <section className="bg-[#FDF6EF] pb-2 pt-8 md:pt-10">
        <div className="section-container">
          <p className="text-center text-lg text-[#64748b]">{content.subtitle}</p>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="section-container">
          <h2 className="font-serif text-3xl font-bold text-[#334155] md:text-4xl">All-in-One Gen Mu&apos;mins Plan</h2>
          <div className="mt-8 max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-orange-200">
            <div className="border-b border-orange-100 p-6">
              <span className="inline-flex rounded-full bg-kidsa-oragne-500 px-3 py-1 text-xs font-bold text-white">
                {bundle.badge}
              </span>
              <h3 className="mt-3 font-heading text-2xl font-bold text-[#334155]">{bundle.title}</h3>
              <p className="mt-1 text-[#64748b]">{bundle.subtitle}</p>
            </div>

            <div className="bg-kidsa-oragne-500 px-6 py-5">
              <div className="flex items-end gap-2">
                <span className="text-base text-white/70 line-through">{bundle.originalPrice}</span>
                <span className="text-4xl font-bold text-white">{bundle.discountedPrice}</span>
                <span className="pb-1 text-sm text-white/90">{bundle.frequency}</span>
              </div>
            </div>

            <div className="p-6">
              <ul className="space-y-2 text-[#475569]">
                {bundle.bullets.map((line) => (
                  <li key={line}>- {line}</li>
                ))}
              </ul>
              <Link
                href="/#pricing"
                className="mt-6 inline-flex rounded-xl bg-[#6B5B95] px-6 py-3 font-semibold text-white transition hover:bg-[#5b4d85]"
              >
                Enroll your Child
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ProgramPricingCards title={content.sectionTitle} cards={content.cards} />
    </div>
  );
}
