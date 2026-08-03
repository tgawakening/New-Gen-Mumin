"use client";

import { ImagePlus, PlusCircle, Trash2, X } from "lucide-react";
import { useState } from "react";

const OPTION_LABELS = ["A", "B", "C", "D"];

type InitialQuestion = {
  prompt?: string;
  type?: string;
  answer?: string;
  choices?: string;
  points?: number;
  imageDataUrl?: string;
};

function QuestionImageField({ index, initialImage }: { index: number; initialImage?: string }) {
  const [image, setImage] = useState(initialImage ?? "");
  const [error, setError] = useState("");
  function chooseImage(file?: File) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > 8 * 1024 * 1024) return setError("Please choose an image smaller than 8 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const source = new Image();
      source.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
        setImage(canvas.toDataURL("image/webp", 0.82));
      };
      source.onerror = () => setError("This image could not be read. Please try another file.");
      source.src = String(reader.result);
    };
    reader.onerror = () => setError("This image could not be read. Please try another file.");
    reader.readAsDataURL(file);
  }
  return <div className="grid gap-2 rounded-[22px] border border-dashed border-[#b8c9d8] bg-white/70 p-4">
    <input type="hidden" name={`image-${index}`} value={image} />
    <span className="text-sm font-semibold text-[#22304a]">Question picture (optional)</span>
    {image ? <div className="relative w-fit"><img src={image} alt="Question preview" className="max-h-64 max-w-full rounded-2xl border border-[#d8e3ed] object-contain" /><button type="button" onClick={() => setImage("")} title="Remove picture" className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#b24646] shadow"><X className="h-4 w-4" /></button></div> : null}
    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[#edf4ff] px-4 py-2 text-xs font-semibold text-[#24598a]"><ImagePlus className="h-4 w-4" />{image ? "Replace picture" : "Add picture"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => chooseImage(event.target.files?.[0])} /></label>
    <span className="text-xs font-normal text-[#617184]">PNG, JPG, WebP or GIF. Large pictures are resized automatically.</span>
    {error ? <span className="text-xs font-semibold text-[#b24646]">{error}</span> : null}
  </div>;
}

function splitChoices(value?: string) {
  return (value ?? "").split(/\n|,/).map((choice) => choice.trim()).filter(Boolean).slice(0, 4);
}

export function QuizQuestionBuilderClient({ initialQuestions = [] }: { initialQuestions?: InitialQuestion[] }) {
  const initialSlots = initialQuestions.length ? initialQuestions.map((_, index) => index + 1) : [1];
  const [questions, setQuestions] = useState(initialSlots);

  function addQuestion() {
    setQuestions((current) => {
      const next = Math.max(0, ...current) + 1;
      return [...current, next];
    });
  }

  function removeQuestion(index: number) {
    setQuestions((current) => (current.length > 1 ? current.filter((question) => question !== index) : current));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[#10223d] p-4 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f7c56f]">Game questions</p>
          <p className="mt-1 text-sm text-white/75">Add a question, write four answer cards, then mark the correct one.</p>
        </div>
        <button
          type="button"
          title="Add more questions"
          onClick={addQuestion}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#22304a] transition hover:bg-[#f7c56f]"
        >
          <PlusCircle className="h-4 w-4" />
          Add question
        </button>
      </div>

      <div className="grid items-start gap-4">
        {questions.map((index, position) => {
          const initial = initialQuestions[position];
          const choices = splitChoices(initial?.choices);
          const correctIndex = Math.max(1, choices.findIndex((choice) => choice.toLowerCase() === (initial?.answer ?? "").toLowerCase()) + 1);
          return (
            <section key={index} className="rounded-[26px] border border-[#eadfce] bg-[#fbf6ef] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Question {position + 1}</p>
                  <p className="mt-1 text-sm text-[#617184]">This will appear on the teacher host screen and students will answer from colour cards.</p>
                </div>
                {questions.length > 1 ? (
                  <button
                    type="button"
                    title="Delete this question"
                    onClick={() => removeQuestion(index)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#b24646] transition hover:bg-[#fff4f4]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                  Question shown on screen
                  <input name={`question-${index}`} defaultValue={initial?.prompt ?? ""} className="min-h-12 rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-base" placeholder="Example: What should we say before eating?" />
                </label>

                <QuestionImageField index={index} initialImage={initial?.imageDataUrl} />

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Question type
                    <select name={`type-${index}`} defaultValue={initial?.type ?? "MCQ"} className="min-h-12 rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm">
                      <option value="MCQ">Multiple choice</option>
                      <option value="TRUE_FALSE">True / false</option>
                      <option value="FILL_IN_BLANK">Fill blank</option>
                      <option value="SHORT_ANSWER">Short answer</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Points
                    <input name={`points-${index}`} type="number" min="1" defaultValue={initial?.points ?? 10} className="min-h-12 rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm" />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {OPTION_LABELS.map((label, optionIndex) => (
                    <label key={label} className={`grid gap-2 rounded-[22px] border-2 p-4 text-sm font-semibold ${["border-[#f97316] bg-[#fff4e8]", "border-[#2563eb] bg-[#edf4ff]", "border-[#16a34a] bg-[#edfff4]", "border-[#a855f7] bg-[#f6edff]"][optionIndex]}`}>
                      <span className="text-[#22304a]">Answer {label}</span>
                      <input name={`choice-${index}-${optionIndex + 1}`} defaultValue={choices[optionIndex] ?? ""} className="min-h-11 rounded-xl border border-white/70 bg-white px-3 py-2 text-sm text-[#22304a]" placeholder={`Option ${label}`} />
                      <span className="flex items-center gap-2 text-xs text-[#4d5a6b]">
                        <input type="radio" name={`correct-${index}`} value={optionIndex + 1} defaultChecked={correctIndex === optionIndex + 1} />
                        Correct answer
                      </span>
                    </label>
                  ))}
                </div>

                <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                  Fallback exact answer for non-MCQ questions
                  <input name={`answer-${index}`} defaultValue={initial?.answer ?? ""} className="min-h-11 rounded-xl border border-[#d8e3ed] bg-white px-3 py-2 text-sm" placeholder="Use for true/false, fill blank, or short answer" />
                </label>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
