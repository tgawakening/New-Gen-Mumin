export const USER_ROLES = ["ADMIN", "TEACHER", "PARENT", "STUDENT", "COMMUNICATIONS"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DASHBOARD_HOME: Record<UserRole, string> = {
  COMMUNICATIONS: "/communications",
  ADMIN: "/admin",
  TEACHER: "/teacher",
  PARENT: "/parent",
  STUDENT: "/student",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  COMMUNICATIONS: "Communications Lead",
  ADMIN: "Admin",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
};

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}
