"use client";

import { PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";

const MAX_QUESTIONS = 10;

export function QuizQuestionBuilderClient() {
  const [questions, setQuestions] = useState([1, 2]);

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

      <div className="grid gap-3 md:grid-cols-2">
        {questions.map((index, position) => (
          <details key={index} className="rounded-[18px] bg-[#fbf6ef] p-4" open={position === 0}>
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
            <div className="mt-3 grid gap-2">
              <input name={`question-${index}`} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm" placeholder="Question" />
              <select name={`type-${index}`} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm">
                <option value="MCQ">Multiple choice</option>
                <option value="TRUE_FALSE">True / false</option>
                <option value="FILL_IN_BLANK">Fill blank</option>
                <option value="SHORT_ANSWER">Short answer</option>
              </select>
              <input name={`answer-${index}`} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm" placeholder="Correct answer" />
              <textarea name={`choices-${index}`} rows={2} className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm" placeholder="MCQ choices, comma or new line" />
              <input name={`points-${index}`} type="number" min="1" defaultValue="1" className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-sm" />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
