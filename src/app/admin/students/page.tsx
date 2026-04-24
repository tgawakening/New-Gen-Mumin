export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminStudentsPage() {
  const students = await db.studentProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      user: true,
      parents: {
        include: {
          parent: {
            include: {
              user: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          program: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Students</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#22304a]">Student roster</h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Review active student profiles, linked guardians, onboarding state, and their current programme access.
          </p>
        </div>

        <div className="grid gap-4">
          {students.map((student) => (
            <div key={student.id} className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#22304a]">
                    {student.displayName || `${student.user.firstName} ${student.user.lastName}`}
                  </h2>
                  <p className="mt-1 text-sm text-[#6d7785]">
                    {student.user.email} · {student.countryName ?? "Country pending"}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.onboardingCompleted ? "bg-[#effaf3] text-[#2f6b4b]" : "bg-[#fff7eb] text-[#8a6326]"}`}>
                  {student.onboardingCompleted ? "Onboarded" : "Needs onboarding"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-[#556274] md:grid-cols-4">
                <span>Age: {student.age ?? "Not set"}</span>
                <span>Active enrollments: {student.enrollments.length}</span>
                <span>Parents linked: {student.parents.length}</span>
                <span>Created: {formatDate(student.createdAt)}</span>
              </div>

              {student.parents.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {student.parents.map((entry) => (
                    <span key={entry.id} className="rounded-full bg-[#fbf6ef] px-3 py-1 text-xs font-medium text-[#4d5a6b]">
                      {entry.parent.user.firstName} {entry.parent.user.lastName}
                    </span>
                  ))}
                </div>
              ) : null}

              {student.enrollments.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {student.enrollments.map((enrollment) => (
                    <span key={enrollment.id} className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-[#2a76aa]">
                      {enrollment.program.title}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#6d7785]">No active programme access yet.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
