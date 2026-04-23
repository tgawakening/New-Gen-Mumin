import { programMethod } from "@/lib/program-content";
import { CheckCircle2 } from "lucide-react";

type ProgramFeatureSectionProps = {
  methodsTitle: string;
  methods: programMethod[];
  parentInfoTitle: string;
  parentInfo: programMethod[];
};

function ListCard({
  title,
  items,
  accent = "orange",
}: {
  title: string;
  items: string[];
  accent?: "orange" | "violet";
}) {
  const accentClass =
    accent === "orange"
      ? "bg-orange-50 ring-orange-100 text-orange-500"
      : "bg-violet-50 ring-violet-100 text-violet-500";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 md:p-7">
      <h3 className="font-heading text-2xl font-bold text-[#334155]">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-[#475569]">
            <span className={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ring-1 ${accentClass}`}>
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgramFeatureSection({
  methodsTitle,
  methods,
  parentInfoTitle,
  parentInfo,
}: ProgramFeatureSectionProps) {
  return (
    <section className="bg-[#FDF6EF] py-12 md:py-16">
      <div className="section-container grid gap-6 lg:grid-cols-2">
        <ListCard title={methodsTitle} items={methods.map((method) => method.title)} accent="orange" />
        <ListCard title={parentInfoTitle} items={parentInfo.map((info) => info.title)} accent="violet" />
      </div>
    </section>
  );
}
