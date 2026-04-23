import { Target } from "lucide-react";

type ProgramGoalsSectionProps = {
  title: string;
  goals: string[];
};

export function ProgramGoalsSection({ title, goals }: ProgramGoalsSectionProps) {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="section-container">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 md:p-8">
          <h3 className="font-heading text-2xl font-bold text-[#334155] md:text-3xl">{title}</h3>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {goals.map((goal) => (
              <li key={goal} className="flex items-start gap-3 rounded-xl bg-[#F8FAFC] p-4">
                <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                <span className="text-[#475569]">{goal}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
