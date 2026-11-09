import ParentRecognitionPage from "@/app/teacher/parent-recognition/page";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { canAwardWeeklyCertificates } from "@/lib/teacher/recognition-permissions";
import { redirect } from "next/navigation";

type Props = Parameters<typeof ParentRecognitionPage>[0];
export default async function CommunicationsCertificatesPage(props: Props) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "COMMUNICATIONS" || !canAwardWeeklyCertificates(session.user)) redirect(getDashboardHome(session.user.role));
  return ParentRecognitionPage(props);
}
