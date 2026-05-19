"use client";

import { PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";

const MAX_QUESTIONS = 10;

type InitialQuestion = {
  prompt?: string;
  type?: string;
  answer?: string;
  choices?: string;
  points?: number;
};

export function QuizQuestionBuilderClient({ initialQuestions = [] }: { initialQuestions?: InitialQuestion[] }) {
  const initialSlots = initialQuestions.length ? initialQuestions.map((_, index) => index + 1) : [1];
  const [questions, setQuestions] = useState(initialSlots);

  function addQuestion() {
    setQuestions((current) => {
      if (current.length >= MAX_QUESTIONS) return current;
      const next = Math.max(0, ...current) + 1;
      return [...current, next];
    });
  }

  function removeQuestion(index: number) {
    setQuestions((current) => current.filter((question) => question !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#22304a]">Quiz questions</p>
        <button
          type="button"
          title="Add more questions"
          onClick={addQuestion}
          disabled={questions.length >= MAX_QUESTIONS}
          className="inline-flex items-center gap-2 rounded-full bg-[#eef5fb] px-4 py-2 text-xs font-semibold text-[#2a76aa] transition hover:bg-[#dfeef8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Add question
        </button>
      </div>

      <div className="grid items-start gap-3">
        {questions.map((index, position) => (
          <details key={index} className="rounded-[18px] border border-[#eadfce] bg-[#fbf6ef] p-3" open={position === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#22304a] [&::-webkit-details-marker]:hidden">
              <span>Question {position + 1}</span>
              {questions.length > 1 ? (
                <button
                  type="button"
                  title="Delete this question"
                  onClick={(event) => {
                    event.preventDefault();
                    removeQuestion(index);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b24646] transition hover:bg-[#fff4f4]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </summary>
            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.5fr)_150px_90px]">
              <input name={`question-${index}`} defaultValue={initialQuestions[position]?.prompt ?? ""} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm" placeholder="Question prompt" />
              <select name={`type-${index}`} defaultValue={initialQuestions[position]?.type ?? "MCQ"} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm">
                <option value="MCQ">MCQ</option>
                <option value="TRUE_FALSE">True / false</option>
                <option value="FILL_IN_BLANK">Fill blank</option>
                <option value="SHORT_ANSWER">Short answer</option>
              </select>
              <label className="grid gap-1 text-xs font-semibold text-[#617184]">
                Points
                <input name={`points-${index}`} type="number" min="1" defaultValue={initialQuestions[position]?.points ?? 1} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm" />
              </label>
              <input name={`answer-${index}`} defaultValue={initialQuestions[position]?.answer ?? ""} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm lg:col-span-2" placeholder="Correct answer" />
              <textarea name={`choices-${index}`} defaultValue={initialQuestions[position]?.choices ?? ""} rows={1} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm" placeholder="MCQ choices" />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
