export type FamilyNavIcon =
  | "home"
  | "book"
  | "check"
  | "calendar"
  | "sparkles"
  | "chart"
  | "journal"
  | "profile"
  | "pen"
  | "sun";

export function getStudentNavItems() {
  return [
    { label: "Dashboard", href: "/student", icon: "home" as const },
    { label: "Courses", href: "/student/courses", icon: "book" as const },
    { label: "Attendance", href: "/student/attendance", icon: "check" as const },
    { label: "Schedule", href: "/student/schedule", icon: "calendar" as const },
    { label: "Quizzes", href: "/student/quizzes", icon: "sparkles" as const },
    { label: "Progress", href: "/student/progress", icon: "chart" as const },
    { label: "Journal", href: "/student/journal", icon: "journal" as const },
    { label: "Submit Journal", href: "/student/journal/submit", icon: "pen" as const },
    { label: "Profile", href: "/student/profile", icon: "profile" as const },
  ];
}

export function getParentNavItems(childId?: string) {
  const suffix = childId ? `?child=${childId}` : "";

  return [
    { label: "Dashboard", href: `/parent${suffix}`, icon: "home" as const },
    { label: "Courses", href: `/parent/courses${suffix}`, icon: "book" as const },
    { label: "Attendance", href: `/parent/attendance${suffix}`, icon: "check" as const },
    { label: "Schedule", href: `/parent/schedule${suffix}`, icon: "calendar" as const },
    { label: "Quizzes", href: `/parent/quizzes${suffix}`, icon: "sparkles" as const },
    { label: "Progress", href: `/parent/progress${suffix}`, icon: "chart" as const },
    { label: "Journal", href: `/parent/journal${suffix}`, icon: "journal" as const },
    { label: "Parent Policies", href: `/parent/policies${suffix}`, icon: "sun" as const },
    { label: "Profile", href: `/parent/profile${suffix}`, icon: "profile" as const },
  ];
}
