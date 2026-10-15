import { getCurrentSession } from '@/lib/auth/session';
import { quizBody, quizFailure, quizString } from '@/lib/quizzes/http';
import { advancePractice, practiceLibrary, readPractice, startPractice } from '@/lib/quizzes/practice';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const session = await getCurrentSession();
 if (!session) return Response.json({ error:'Please sign in.' },{ status:401 });
 try {
  const url = new URL(request.url), studentId = quizString(url.searchParams.get('studentId')), id = url.searchParams.get('id');
  return Response.json(id ? await readPractice(session.user,studentId,quizString(id)) : await practiceLibrary(session.user,studentId),{ headers:{ 'Cache-Control':'private, no-store' } });
 } catch(error) { return quizFailure(error); }
}
export async function POST(request: Request) {
 const session = await getCurrentSession();
 if (!session) return Response.json({ error:'Please sign in.' },{ status:401 });
 try {
  const body = await quizBody(request), studentId = quizString(body.studentId);
  const result = body.action === 'start' ? await startPractice(session.user,studentId,quizString(body.quizId)) : await advancePractice(session.user,studentId,quizString(body.id), { action:quizString(body.action), questionId:quizString(body.questionId), answer: typeof body.answer === 'string' ? body.answer.slice(0,2000) : '' });
  return Response.json(result,{ headers:{ 'Cache-Control':'private, no-store' } });
 } catch(error) { return quizFailure(error); }
}
