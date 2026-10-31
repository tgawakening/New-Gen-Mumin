import { notFound, redirect } from 'next/navigation';
import { getCurrentSession, getDashboardHome } from '@/lib/auth/session';
import { LiveQuizRoom } from '@/components/quizzes/LiveQuizRoom';
import Link from 'next/link';
import { db } from '@/lib/db';
export default async function QuizRoomPage({ params, searchParams }: { params: Promise<{sessionId:string}>; searchParams: Promise<{child?:string}> }) {
 const session = await getCurrentSession();
 if (!session) redirect('/auth/login');
 if (session.user.role !== 'PARENT') redirect(getDashboardHome(session.user.role));
 const { sessionId } = await params; const { child } = await searchParams;
 if (!child) {
  const live = await db.quizLiveSession.findUnique({ where: { id: sessionId }, select: { quizId: true } });
  const quiz = live ? await db.quiz.findUnique({ where: { id: live.quizId }, select: { isPublished: true } }) : null;
  if (!quiz?.isPublished) notFound();
  const seats = await db.quizLiveSeat.findMany({ where: { sessionId, student: { parents: { some: { parent: { userId: session.user.id } } }, user: { status: 'ACTIVE' } } }, select: { studentId: true, student: { select: { displayName: true, user: { select: { firstName: true, lastName: true } } } } } });
  return <main className="min-h-screen bg-[#f7f2ea] px-4 py-8 text-[#22304a]"><section className="mx-auto max-w-xl rounded-3xl border bg-white p-6"><h1 className="text-2xl font-bold">Who is taking this quiz?</h1><p className="mt-3 text-sm leading-6 text-[#617184]">Choose your child so their answers, marks and Qabila points are recorded for the correct learner. Each child needs their own quiz attempt.</p><div className="mt-5 grid gap-3">{seats.map(seat => <Link key={seat.studentId} href={`/parent/quizzes/live/${encodeURIComponent(sessionId)}?child=${encodeURIComponent(seat.studentId)}`} className="min-h-12 rounded-2xl border bg-[#fff8e8] px-5 py-4 font-bold">{seat.student.displayName || `${seat.student.user.firstName} ${seat.student.user.lastName || ''}`.trim()}</Link>)}</div>{!seats.length ? <p className="mt-5 text-sm">No linked child is on this quiz roster. Please check with the teacher.</p> : null}<Link href="/parent/quizzes" className="mt-5 inline-block py-2 text-sm font-semibold underline">Back to quizzes</Link></section></main>;
 }
 return <LiveQuizRoom sessionId={sessionId} role="parent" child={child} />;
}
