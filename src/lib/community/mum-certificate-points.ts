type LinkedChild = { studentId: string; student: { houseMembership: { houseId: string; qabilaGroup: string | null } | null } };

/** Share one 150-point family award across linked children with assigned Qabilas. */
export function mumCertificateShares(links: LinkedChild[]) {
  const children = [...new Map(links.filter(link => link.student.houseMembership?.qabilaGroup?.trim()).map(link => [link.studentId, link])).values()]
    .sort((a, b) => a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0);
  return children.map((link, index) => ({ studentId: link.studentId, houseId: link.student.houseMembership!.houseId,
    points: Math.floor(150 / children.length) + (index < 150 % children.length ? 1 : 0) }));
}
