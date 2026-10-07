import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { quizLobbyList } from '@/lib/quizzes/runtime';
import { quizFailure } from '@/lib/quizzes/http';
export const dynamic = 'force-dynamic';
export async function GET() {
 const session = await getCurrentSession(); if (!session) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
 try { return NextResponse.json({ quizzes: await quizLobbyList(session.user) }, { headers: { 'Cache-Control': 'private, no-store' } }); } catch (error) { return quizFailure(error); }
}
