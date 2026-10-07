import { redirect } from 'next/navigation';
import { getCurrentSession, getDashboardHome } from '@/lib/auth/session';
import { LiveQuizRoom } from '@/components/quizzes/LiveQuizRoom';
export default async function QuizRoomPage({ params, searchParams }: { params: Promise<{sessionId:string}>; searchParams: Promise<{child?:string}> }) {
 const session = await getCurrentSession();
 if (!session) redirect('/auth/login');
 if (session.user.role !== 'TEACHER') redirect(getDashboardHome(session.user.role));
 const { sessionId } = await params; const { child } = await searchParams;
 return <LiveQuizRoom sessionId={sessionId} role="teacher" child={child} />;
}
