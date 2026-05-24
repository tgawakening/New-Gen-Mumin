"use client";

import { type MouseEvent, type ReactNode, useState } from "react";

type MultiStepFeedbackFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  steps: Array<{
    title: string;
    description?: string;
    content: ReactNode;
  }>;
  hiddenFields?: Array<{ name: string; value: string }>;
  submitLabel: string;
};

export function MultiStepFeedbackForm({
  action,
  steps,
  hiddenFields = [],
  submitLabel,
}: MultiStepFeedbackFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const isFirst = activeStep === 0;
  const isLast = activeStep === steps.length - 1;
  const step = steps[activeStep];

  function goNext(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) return;
    setActiveStep((value) => Math.min(steps.length - 1, value + 1));
  }

  return (
    <form action={action} className="grid gap-5">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}

      <div className="rounded-[22px] border border-[#f0d4bb] bg-[#fff8f0] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
              {activeStep + 1} / {steps.length}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{step.title}</h3>
            {step.description ? <p className="mt-1 text-sm leading-6 text-[#617184]">{step.description}</p> : null}
          </div>
          <div className="flex items-center gap-1">
            {steps.map((item, index) => (
              <span
                key={item.title}
                className={`h-2.5 rounded-full transition-all ${index === activeStep ? "w-8 bg-[#f39f5f]" : "w-2.5 bg-[#eadfce]"}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4">{step.content}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setActiveStep((value) => Math.max(0, value - 1))}
          disabled={isFirst}
          className="rounded-full border border-[#d8e3ed] bg-white px-5 py-2.5 text-sm font-semibold text-[#22304a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        {isLast ? (
          <button className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">
            {submitLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Next
          </button>
        )}
      </div>
    </form>
  );
}
