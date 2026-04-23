import type { CurriculumKind, ProgramCurriculumItem } from "@/lib/program-content";

type ProgramCurriculumSectionProps = {
  title: string;
  kind: CurriculumKind;
  items: ProgramCurriculumItem[];
};

export function ProgramCurriculumSection({ title, kind, items }: ProgramCurriculumSectionProps) {
  return (
    <section className="bg-[#FDF6EF] py-12 md:py-16 lg:py-20">
      <div className="section-container">
        <h3 className="font-heading text-2xl font-bold text-[#334155] md:text-3xl">{title}</h3>

        <div className="mt-8 grid gap-4 md:gap-5 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.title}
              className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ${
                kind === "stages" ? "ring-orange-100" : "ring-violet-100"
              }`}
            >
              <h4
                className={`font-heading text-xl font-bold ${
                  kind === "stages" ? "text-orange-600" : "text-violet-600"
                }`}
              >
                {item.title}
              </h4>
              <ul className="mt-4 space-y-2 text-[#475569]">
                {item.points.map((point) => (
                  <li key={point} className="leading-relaxed">
                    - {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
