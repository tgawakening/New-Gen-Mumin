import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { NotificationBellClient } from "@/components/dashboard/NotificationBellClient";

export async function NotificationBell() {
  const session = await getCurrentSession();
  if (!session) return null;

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return <NotificationBellClient notifications={notifications} />;
}
