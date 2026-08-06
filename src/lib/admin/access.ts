import "server-only";

import { db } from "@/lib/db";

export const RESTRICTED_ADMIN_PROFILE_TITLE = "GEN_MUMIN_CO_PROJECT_MANAGER_NO_FINANCE";

export async function canAccessAdminFinance(userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, role: "ADMIN", status: "ACTIVE" },
    select: { adminProfile: { select: { title: true } } },
  });
  return Boolean(user && user.adminProfile?.title !== RESTRICTED_ADMIN_PROFILE_TITLE);
}