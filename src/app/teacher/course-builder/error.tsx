"use client";

export default function TeacherCourseBuilderError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-[#efb3b3] bg-[#fff4f4] p-6 text-[#8f3333]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">Course builder</p>
      <h2 className="mt-2 text-2xl font-semibold">The builder needs a refresh</h2>
      <p className="mt-3 text-sm leading-6">
        The last curriculum action could not reload cleanly. Use the button below to reload the builder workspace.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-full bg-[#22304a] px-5 py-2 text-sm font-semibold text-white"
      >
        Reload builder
      </button>
    </div>
  );
}
