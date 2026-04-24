export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-[#effaf3] text-[#2f6b4b]";
  if (status === "DRAFT") return "bg-[#fff7eb] text-[#8a6326]";
  return "bg-[#eef2f6] text-[#556274]";
}

export default async function AdminProgramsPage() {
  const programs = await db.program.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          enrollments: true,
          schedules: true,
          quizzes: true,
          assignments: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Programs</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#22304a]">Program catalog</h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Watch programme status, price points, and the attached classroom content footprint as the LMS grows.
          </p>
        </div>

        <div className="grid gap-4">
          {programs.map((program) => (
            <div key={program.id} className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#22304a]">{program.title}</h2>
                  <p className="mt-1 text-sm text-[#6d7785]">{program.shortDescription ?? "Programme description coming soon."}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(program.status)}`}>
                  {program.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-[#556274] md:grid-cols-4">
                <span>GBP: £{program.monthlyPriceGbp}</span>
                <span>PKR: {program.monthlyPricePkr ?? "—"}</span>
                <span>Enrollments: {program._count.enrollments}</span>
                <span>Schedules: {program._count.schedules}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-[#2a76aa]">
                  Quizzes: {program._count.quizzes}
                </span>
                <span className="rounded-full bg-[#fbf6ef] px-3 py-1 text-xs font-medium text-[#4d5a6b]">
                  Assignments: {program._count.assignments}
                </span>
                {program.isBundle ? (
                  <span className="rounded-full bg-[#fff0dd] px-3 py-1 text-xs font-medium text-[#b1692a]">
                    Bundle
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
