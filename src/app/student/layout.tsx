import { Suspense, type ReactNode } from 'react';
import { LiveQuizBanner } from '@/components/quizzes/LiveQuizBanner';
import { FamilyNavigation } from '@/components/dashboard/family/FamilyNavigation';
import { FamilyPageLoading } from '@/components/dashboard/family/FamilyPageLoading';
export default function Layout({ children }: {children: ReactNode}) { return <FamilyNavigation><LiveQuizBanner role="student" /><Suspense fallback={<FamilyPageLoading role="student" />}>{children}</Suspense></FamilyNavigation>; }
