import { TeacherSignupForm } from "@/components/auth/TeacherSignupForm";

export default function TeacherRegistrationPage() {
  return (
    <div className="min-h-screen bg-[#f7f2ea] py-14">
      <div className="section-container grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[32px] bg-[#22304a] p-8 text-white shadow-[0_24px_60px_rgba(34,48,74,0.2)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f2c58f]">
            Teacher onboarding
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Join the Gen-Mumins teaching team</h1>
          <p className="mt-4 text-base leading-8 text-white/80">
            Create your teacher account, set your teaching profile, and move into the class, quiz,
            journal, reports, and course-builder workspace.
          </p>
          <div className="mt-8 space-y-3 text-sm leading-7 text-white/80">
            <p>Classes overview, roster visibility, and weekly schedule</p>
            <p>Assessment review across pre-lesson and post-lesson quizzes</p>
            <p>Lesson logs, journals, reports, and course-building foundation</p>
          </div>
        </div>

        <TeacherSignupForm />
      </div>
    </div>
  );
}
