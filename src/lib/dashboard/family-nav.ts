export function getStudentNavItems() {
  return [
    { label: "Dashboard", href: "/student" },
    { label: "Courses", href: "/student/courses" },
    { label: "Attendance", href: "/student/attendance" },
    { label: "Schedule", href: "/student/schedule" },
    { label: "Quizzes", href: "/student/quizzes" },
    { label: "Progress", href: "/student/progress" },
    { label: "Journal", href: "/student/journal" },
    { label: "Profile", href: "/student/profile" },
  ];
}

export function getParentNavItems(childId?: string) {
  const suffix = childId ? `?child=${childId}` : "";

  return [
    { label: "Dashboard", href: `/parent${suffix}` },
    { label: "Courses", href: `/parent/courses${suffix}` },
    { label: "Attendance", href: `/parent/attendance${suffix}` },
    { label: "Schedule", href: `/parent/schedule${suffix}` },
    { label: "Quizzes", href: `/parent/quizzes${suffix}` },
    { label: "Progress", href: `/parent/progress${suffix}` },
    { label: "Journal", href: `/parent/journal${suffix}` },
    { label: "Profile", href: `/parent/profile${suffix}` },
  ];
}
