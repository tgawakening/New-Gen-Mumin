import "server-only";
import { getWeeklyCertificateParents } from "@/lib/teacher/weekly-certificate-parents";
import { db } from "@/lib/db";
import { canAwardWeeklyCertificates } from "@/lib/teacher/recognition-permissions";
import { sendRecognitionEarnedEmail, sendParentRecognitionEmail } from "@/lib/email/notifications";
import { mumCertificateShares } from "@/lib/community/mum-certificate-points";

// A single switch controls family visibility, notifications and the Qabila credit.
// Lock the award so concurrent publish requests cannot duplicate notifications.
export async function setCertificatePublication(input: { userId: string; awardId: string; parent: boolean; isPublic: boolean }) {
  const actor = await db.user.findUnique({ where: { id: input.userId } });
  if (!actor || !canAwardWeeklyCertificates(actor)) throw new Error("You cannot manage weekly certificates.");
  const eligibleFamilies = input.parent && input.isPublic ? await getWeeklyCertificateParents(actor) : [];
  const result = await db.$transaction(async (tx) => {
    if (input.parent) await tx.$queryRaw`SELECT id FROM ParentRecognitionAward WHERE id = ${input.awardId} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM RecognitionAward WHERE id = ${input.awardId} FOR UPDATE`;
    const award = input.parent
      ? await tx.parentRecognitionAward.findUnique({ where: { id: input.awardId } })
      : await tx.recognitionAward.findUnique({ where: { id: input.awardId } });
    if (!award || award.revokedAt || (!input.parent && award.badgeKey !== "MUMIN_OF_WEEK")) throw new Error("Weekly certificate not found.");
    const href = `${input.parent ? "/parent-certificates" : "/certificates"}/${award.certificateCode}`;
    const sourceType = input.parent ? "PARENT_RECOGNITION_MUM_OF_WEEK" : "RECOGNITION_MUMIN_OF_WEEK";
    const changed = award.isPublic !== input.isPublic;
    if (input.parent) await tx.parentRecognitionAward.update({ where: { id: award.id }, data: { isPublic: input.isPublic } });
    else await tx.recognitionAward.update({ where: { id: award.id }, data: { isPublic: input.isPublic } });
    if (!input.isPublic) {
      const legacyParent = input.parent && "parentId" in award ? await tx.parentProfile.findUnique({ where: { id: award.parentId }, select: { userId: true } }) : null;
      await tx.housePointLedger.deleteMany({ where: { sourceType, sourceId: award.id } });
      await tx.notification.deleteMany({ where: { OR: [{ href }, { href: `/badges/${award.certificateCode}` }, ...(legacyParent && award.evidence ? [{ userId: legacyParent.userId, href: "/parent/rewards", body: { contains: award.evidence } }] : []), { href: { startsWith: `/teacher/recognition?award=${encodeURIComponent(award.id)}&` } }] } });
      return { changed, award, recipients: [], href };
    }
    const parent = input.parent && "parentId" in award ? await tx.parentProfile.findUnique({ where: { id: award.parentId }, include: { user: true } }) : null;
    const family = parent ? eligibleFamilies.find(candidate => candidate.id === parent.id) : null;
    const familyStudents = parent && family ? await tx.studentProfile.findMany({ where: { id: { in: family.children.map(child => child.id) } }, include: { houseMembership: true } }) : [];
    const links = familyStudents.map(student => ({ studentId: student.id, student }));
    const studentId = "studentId" in award ? award.studentId : undefined;
    const student = studentId ? await tx.studentProfile.findUnique({ where: { id: studentId }, include: { user: true, houseMembership: true, parents: { include: { parent: { include: { user: true } } } } } }) : null;
    const secondStudent = "secondStudentId" in award && award.secondStudentId ? await tx.studentProfile.findUnique({ where: { id: award.secondStudentId }, include: { user: true, houseMembership: true, parents: { include: { parent: { include: { user: true } } } } } }) : null;
    const students = [student, secondStudent].filter((child): child is NonNullable<typeof student> => child !== null);
    if (input.parent && award.badgeKey === "MUM_OF_WEEK") {
      const shares = mumCertificateShares(links);
      if (!shares.length) throw new Error("Assign at least one linked child to a Qabila before publishing this Mum certificate.");
      await tx.housePointLedger.deleteMany({ where: { sourceType, sourceId: award.id } });
      await tx.housePointLedger.createMany({ data: shares.filter(share => share.points > 0).map(share => ({ ...share,
        id: `mum-share-${award.id}-${share.studentId}`, sourceType, sourceId: award.id,
        reason: `${award.title}: family bonus share (${share.points}/150 points)`.slice(0, 191), awardedAt: award.awardedAt,
      })) });
      await tx.parentRecognitionAward.update({ where: { id: award.id }, data: { pointsStudentId: null } });
    } else if (!input.parent) {
      if (!student || ("secondStudentId" in award && award.secondStudentId && !secondStudent) || students.some(child => !child.houseMembership?.qabilaGroup)) throw new Error("Assign every recipient to a Qabila before publishing this weekly certificate. Its 150 points cannot be credited yet.");
      // Replace all shares under the award lock, so retries and hiding stay safe.
      await tx.housePointLedger.deleteMany({ where: { sourceType, sourceId: award.id } });
      await tx.housePointLedger.createMany({ data: students.map(child => ({ studentId: child.id, houseId: child.houseMembership!.houseId, sourceType, sourceId: award.id, points: 150 / students.length, reason: `${award.title}: ${award.evidence || "Weekly recognition"}`.slice(0, 191), awardedAt: award.awardedAt })) });
    }
    const recipientList = parent ? [{ userId: parent.userId, email: parent.user.email, name: award.recipientName || parent.user.firstName }]
      : students.flatMap(child => [{ userId: child.userId, email: child.user.email, name: child.displayName || child.user.firstName }, ...child.parents.map(link => ({ userId: link.parent.userId, email: link.parent.user.email, name: link.parent.user.firstName }))]);
    const recipients = [...new Map(recipientList.map(recipient => [recipient.userId, recipient])).values()];
    if (changed && recipients.length) await tx.notification.createMany({ data: recipients.map(recipient => ({ userId: recipient.userId, title: `${award.title} certificate published!`, body: award.evidence || award.description, href })) });
    return { changed, award, recipients, href };
  });
  if (input.isPublic && result.changed) await Promise.allSettled(result.recipients.filter(recipient => !recipient.email.toLowerCase().endsWith("@genmumin.local")).map(recipient => input.parent
    ? sendParentRecognitionEmail({ toEmail: recipient.email, recipientName: recipient.name, badgeTitle: result.award.title, evidence: result.award.evidence || result.award.description, certificatePath: result.href })
    : sendRecognitionEarnedEmail({ toEmail: recipient.email, recipientName: recipient.name, studentName: result.award.recipientName || result.recipients[0]?.name || "Student", badgeTitle: result.award.title, evidence: result.award.evidence || result.award.description, awardKind: "certificate", pointsBonus: "secondStudentId" in result.award && result.award.secondStudentId ? 75 : 150, rewardsPath: result.href })));
  return result.award;
}

export async function hideAllWeeklyCertificates(userId: string) {
  const actor = await db.user.findUnique({ where: { id: userId } });
  if (!actor || !canAwardWeeklyCertificates(actor)) throw new Error("You cannot manage weekly certificates.");
  const [students, parents] = await Promise.all([
    db.recognitionAward.findMany({ where: { badgeKey: "MUMIN_OF_WEEK", isPublic: true, revokedAt: null }, select: { id: true } }),
    db.parentRecognitionAward.findMany({ where: { isPublic: true, revokedAt: null }, select: { id: true } }),
  ]);
  for (const award of students) await setCertificatePublication({ userId, awardId: award.id, parent: false, isPublic: false });
  for (const award of parents) await setCertificatePublication({ userId, awardId: award.id, parent: true, isPublic: false });
}
