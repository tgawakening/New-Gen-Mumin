import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { quizState, joinQuiz, submitQuizAnswer, controlQuiz, QuizError } from '@/lib/quizzes/runtime';
import { quizBody, quizFailure, quizString } from '@/lib/quizzes/http';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ sessionId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
 const session = await getCurrentSession(); if (!session) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
 try { const { sessionId } = await params; return NextResponse.json(await quizState(sessionId, session.user, request.nextUrl.searchParams.get('child') || undefined, request.nextUrl.searchParams.get('known') || undefined), { headers: { 'Cache-Control': 'private, no-store' } }); } catch (error) { return quizFailure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
 const receivedAt = new Date(); // Server receipt time, before database work, determines whether an answer was on time.
 const session = await getCurrentSession(); if (!session) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
 try {
  const { sessionId } = await params, body = await quizBody(request), action = quizString(body.action);
  const studentId = body.studentId === undefined ? undefined : quizString(body.studentId);
  if (action === 'join') return NextResponse.json({ studentId: await joinQuiz(sessionId, session.user, studentId, body.avatarId === undefined ? undefined : quizString(body.avatarId)) });
  if (action === 'answer') {
   const round = quizString(body.round); if (!Number.isFinite(Date.parse(round))) throw new QuizError('Invalid round.');
   return NextResponse.json({ response: await submitQuizAnswer(sessionId, session.user, { studentId, questionId: quizString(body.questionId), round, answer: quizString(body.answer, 4000) }, receivedAt) });
  }
  if (body.round !== undefined && body.round !== null && (typeof body.round !== 'string' || !Number.isFinite(Date.parse(body.round)))) throw new QuizError('Invalid round.');
  const nextSessionId = await controlQuiz(sessionId, session.user, { action, questionId: body.questionId === undefined ? undefined : quizString(body.questionId), round: body.round as string | null | undefined });
  return NextResponse.json({ ok: true, nextSessionId });
 } catch (error) { return quizFailure(error); }
}
