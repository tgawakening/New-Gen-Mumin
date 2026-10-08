import { Suspense, type ReactNode } from 'react';
import { LiveQuizBanner } from '@/components/quizzes/LiveQuizBanner';
import { FamilyNavigation } from '@/components/dashboard/family/FamilyNavigation';
import { FamilyPageLoading } from '@/components/dashboard/family/FamilyPageLoading';
export default function Layout({ children }: {children: ReactNode}) { return <FamilyNavigation><LiveQuizBanner role="parent" /><Suspense fallback={<FamilyPageLoading role="parent" />}>{children}</Suspense></FamilyNavigation>; }
