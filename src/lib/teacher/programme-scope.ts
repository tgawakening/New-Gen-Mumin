type TeacherIdentity = { firstName: string; lastName?: string | null; email: string };
type Programme = { slug: string; title?: string };

export function isSeerahParentalTeacher(user: TeacherIdentity) {
  return user.email.trim().toLowerCase() === "mehranraziq@gmail.com"
    || /\bmehran\b/i.test(`${user.firstName} ${user.lastName ?? ""}`);
}

/** Old assignments must not restore subjects the teacher no longer teaches. */
export function canSeeTeacherProgramme(user: TeacherIdentity, programme: Programme) {
  if (!isSeerahParentalTeacher(user)) return true;
  return /^(seerah|parental|parenting)(-|$)/i.test(programme.slug.trim());
}

export function scopeTeacherAssignments<T extends { program: Programme }>(user: TeacherIdentity, assignments: T[]) {
  return assignments.filter(assignment => canSeeTeacherProgramme(user, assignment.program));
}
