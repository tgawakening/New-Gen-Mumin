import "server-only";

import { db } from "@/lib/db";
import { canonicalQabilaName, QABILA_NAMES } from "@/lib/community/qabilas";

export async function getAdminQabilaMemberships() {
  return db.houseMembership.findMany({
    where: { qabilaGroup: { not: null } },
    select: {
      studentId: true, qabilaGroup: true, role: true,
      student: { select: { displayName: true, user: { select: { firstName: true, lastName: true, status: true } } } },
    },
    orderBy: { studentId: "asc" },
  });
}

export function groupQabilaMembers(memberships: Awaited<ReturnType<typeof getAdminQabilaMemberships>>) {
  return QABILA_NAMES.map((name) => ({
    name,
    members: memberships.filter((item) => canonicalQabilaName(item.qabilaGroup) === name)
      .map((item) => ({
        studentId: item.studentId,
        name: item.student.displayName?.trim() || [item.student.user.firstName, item.student.user.lastName].filter(Boolean).join(" ").trim() || "Unnamed learner",
        role: item.role.replaceAll("_", " "),
        accountStatus: item.student.user.status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.studentId.localeCompare(b.studentId)),
  }));
}

export function qabilaMembersCsv(groups: ReturnType<typeof groupQabilaMembers>) {
  const cell = (value: string) => {
    const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const rows = [["Qabila", "Learner name", "Student ID", "Qabila role", "Account status"],
    ...groups.flatMap((group) => group.members.map((member) => [group.name, member.name, member.studentId, member.role, member.accountStatus]))];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
