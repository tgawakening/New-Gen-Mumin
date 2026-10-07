import type { ReactNode } from 'react';
import { LiveQuizBanner } from '@/components/quizzes/LiveQuizBanner';
export default function Layout({ children }: {children: ReactNode}) { return <><LiveQuizBanner role="student" />{children}</>; }
