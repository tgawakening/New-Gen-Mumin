import type { QuizQuestionView } from './protocol';
export type PracticeQuestion = QuizQuestionView & { correctAnswer: string };
export type PracticeAnswer = { questionId: string; prompt: string; answer: string; correctAnswer: string; correct: boolean; timedOut: boolean; points: number };
export type PracticeView = {
 id: string; title: string; questionNumber: number; questionCount: number; score: number; correctCount: number;
 finished: boolean; serverNow: number; deadline: number; question: QuizQuestionView | null; response: PracticeAnswer | null; answers: PracticeAnswer[];
};
export function scorePracticeAnswer(question: PracticeQuestion, answer: string, expired: boolean): PracticeAnswer {
 const correct = !expired && answer.trim().toLocaleLowerCase() === question.correctAnswer.trim().toLocaleLowerCase();
 return { questionId: question.id, prompt: question.prompt, answer: expired ? '' : answer.trim(), correctAnswer: question.correctAnswer, correct, timedOut: expired, points: correct ? Math.max(0, question.points) : 0 };
}
