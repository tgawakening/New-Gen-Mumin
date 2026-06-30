export type FamilyNavIcon =
  | "home"
  | "book"
  | "check"
  | "calendar"
  | "video"
  | "sparkles"
  | "chart"
  | "journal"
  | "profile"
  | "pen"
  | "sun";

export function getStudentNavItems() {
  return [
    { label: "Dashboard", href: "/student", icon: "home" as const },
    { label: "Live Sessions", href: "/student/schedule", icon: "calendar" as const },
    { label: "Recordings", href: "/student/recordings", icon: "video" as const },
    { label: "Curriculum", href: "/student/courses", icon: "book" as const },
    { label: "Attendance", href: "/student/attendance", icon: "check" as const },
    { label: "Quizzes", href: "/student/quizzes", icon: "sparkles" as const },
    { label: "Missions", href: "/student/missions", icon: "sparkles" as const },
    { label: "Community", href: "/student/community", icon: "sun" as const },
    { label: "Progress", href: "/student/progress", icon: "chart" as const },
    { label: "Journal", href: "/student/journal", icon: "journal" as const },
    { label: "Submit Journal", href: "/student/journal/submit", icon: "pen" as const },
    { label: "Feedback", href: "/student/feedback", icon: "journal" as const },
    { label: "Profile", href: "/student/profile", icon: "profile" as const },
  ];
}

export function getParentNavItems(childId?: string) {
  const suffix = childId ? `?child=${childId}` : "";

  return [
    { label: "Dashboard", href: `/parent${suffix}`, icon: "home" as const },
    { label: "Live Sessions", href: `/parent/schedule${suffix}`, icon: "calendar" as const },
    { label: "Recordings", href: `/parent/recordings${suffix}`, icon: "video" as const },
    { label: "Curriculum", href: `/parent/courses${suffix}`, icon: "book" as const },
    { label: "Attendance", href: `/parent/attendance${suffix}`, icon: "check" as const },
    { label: "Quizzes", href: `/parent/quizzes${suffix}`, icon: "sparkles" as const },
    { label: "Community", href: `/parent/community${suffix}`, icon: "sun" as const },
    { label: "Progress", href: `/parent/progress${suffix}`, icon: "chart" as const },
    { label: "Journal", href: `/parent/journal${suffix}`, icon: "journal" as const },
    { label: "Feedback", href: `/parent/feedback${suffix}`, icon: "journal" as const },
    { label: "Profile", href: `/parent/profile${suffix}`, icon: "profile" as const },
  ];
}
