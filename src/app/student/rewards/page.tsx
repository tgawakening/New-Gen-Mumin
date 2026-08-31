import { redirect } from "next/navigation";
import { FamilyDashboardFrame } from "@/components/dashboard/family/FamilyDashboardFrame";
import { RewardsDashboard } from "@/components/dashboard/family/RewardsDashboard";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getRecognitionDashboard } from "@/lib/community/recognition";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
export default async function StudentRewardsPage(){const session=await getCurrentSession();if(!session)redirect("/auth/login");if(session.user.role!=="STUDENT")redirect(getDashboardHome(session.user.role));const dashboard=await getStudentDashboardData(session.user.id);if(!dashboard)redirect("/auth/login");const data=await getRecognitionDashboard(dashboard.child.id);return <FamilyDashboardFrame roleLabel="Student Dashboard" title="House & Rewards" subtitle="Build character, strengthen your House, and recognise service." navItems={getStudentNavItems()} pendingReason={dashboard.pendingReason}><RewardsDashboard data={data}/></FamilyDashboardFrame>}