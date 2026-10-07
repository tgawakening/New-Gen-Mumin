export type QuizQuestionView = { id: string; prompt: string; type: string; points: number; choices: string[]; image?: string };
export type QuizAnswerView = { questionId: string; answer: string; correct: boolean | null; points: number; seconds: number };
export type QuizRosterView = { id: string; name: string; avatar: string | null; house: string; joined: boolean; answer?: QuizAnswerView };
export type LiveQuizState = {
 id: string; title: string; status: string; serverNow: string; round: string | null; questionId: string | null;
 duration: number; deadline: string | null; questionCount: number; questionNumber: number;
 question?: QuizQuestionView | null; response: QuizAnswerView | null; responses: QuizAnswerView[];
 learner?: { id: string; name: string; avatar: string | null };
 questions?: QuizQuestionView[]; roster?: QuizRosterView[];
 teams?: Array<{ name: string; points: number }>; bonus: number;
};
export type QuizLobby = { sessionId: string; studentId: string; childName: string; title: string; status: string };
export const QUIZ_LEASE_MS = 15 * 60 * 1000;
export function quizDuration(meta: unknown) {
 const value = meta && typeof meta === 'object' ? Number((meta as { responseWindowSeconds?: unknown }).responseWindowSeconds) : 60;
 return Number.isFinite(value) ? Math.min(3600, Math.max(60, value || 60)) : 60;
}
export function roundAcceptsAnswer(session: { status: string; currentQuestionId: string | null; currentQuestionStartedAt: Date | null }, questionId: string, round: string, receivedAt: Date, duration: number) {
 return session.status === 'LIVE' && session.currentQuestionId === questionId && session.currentQuestionStartedAt?.toISOString() === round && receivedAt.getTime() <= session.currentQuestionStartedAt.getTime() + (duration + 5) * 1000;
}
export function publicQuestion(q: { id: string; prompt: string; type: string; points: number; meta: unknown }, image = true): QuizQuestionView {
 const meta = q.meta && typeof q.meta === 'object' && !Array.isArray(q.meta) ? q.meta as { choices?: unknown; imageDataUrl?: unknown } : {};
 return { id: q.id, prompt: q.prompt, type: q.type, points: q.points, choices: q.type === 'TRUE_FALSE' ? ['true', 'false'] : Array.isArray(meta.choices) ? meta.choices.filter((v): v is string => typeof v === 'string') : [], ...(image && typeof meta.imageDataUrl === 'string' && meta.imageDataUrl.startsWith('data:image/') ? { image: meta.imageDataUrl } : {}) };
}
