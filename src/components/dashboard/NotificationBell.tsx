import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { NotificationBellClient } from "@/components/dashboard/NotificationBellClient";

type NotificationView = { id: string; userId: string; title: string; body: string; href: string | null; createdAt: string; readAt: string | null };

async function loadNotifications(userId: string): Promise<NotificationView[] | null> {
  try {
    const rows = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 25 });
    return rows.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), readAt: item.readAt?.toISOString() ?? null }));
  } catch (error) {
    console.error("NotificationBell server error", error);
    return null;
  }
}

export async function NotificationBell() {
  const session = await getCurrentSession();
  if (!session) return null;
  const notifications = await loadNotifications(session.user.id);
  return notifications ? <NotificationBellClient notifications={notifications} /> : null;
}