import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { openQuizLobby } from '@/lib/quizzes/runtime';
import { quizBody, quizFailure, quizString } from '@/lib/quizzes/http';
export async function POST(request: Request) {
 const session = await getCurrentSession(); if (!session || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Teacher access required.' }, { status: 401 });
 try { const body = await quizBody(request); const live = await openQuizLobby(quizString(body.quizId), session.user.id); return NextResponse.json({ sessionId: live.id }); } catch (error) { return quizFailure(error); }
}
