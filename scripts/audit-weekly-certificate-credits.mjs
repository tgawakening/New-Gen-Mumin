import { PrismaClient } from '@prisma/client';

// Read-only: no publication, point awards, notifications or emails.
const raw = process.env.APP_DATABASE_URL || process.env.GEN_MUMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!raw) throw new Error('Run this read-only check in the DigitalOcean App Platform console. Do not paste database credentials.');
const url = raw.trim().replace(/^["']|["']$/g, '').replace(/ssl-mode=REQUIRED/gi, 'sslaccept=accept_invalid_certs');
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const [mumin, mum] = await Promise.all([
    db.recognitionAward.findMany({ where: { badgeKey: 'MUMIN_OF_WEEK' }, select: { id: true, title: true, recipientName: true, studentId: true, isPublic: true, revokedAt: true, awardedAt: true }, orderBy: { awardedAt: 'desc' }, take: 1000 }),
    db.parentRecognitionAward.findMany({ where: { badgeKey: 'MUM_OF_WEEK' }, select: { id: true, title: true, recipientName: true, parentId: true, pointsStudentId: true, isPublic: true, revokedAt: true, awardedAt: true }, orderBy: { awardedAt: 'desc' }, take: 1000 }),
  ]);
  const ids = [...mumin, ...mum].map(award => award.id);
  const [credits, links] = await Promise.all([
    db.housePointLedger.findMany({ where: { sourceId: { in: ids }, sourceType: { in: ['RECOGNITION_MUMIN_OF_WEEK', 'PARENT_RECOGNITION_MUM_OF_WEEK'] } }, select: { sourceId: true, sourceType: true, studentId: true, points: true, awardedAt: true } }),
    db.parentStudent.findMany({ where: { parentId: { in: mum.map(award => award.parentId) } }, select: { parentId: true, studentId: true } }),
  ]);
  const studentIds = [...new Set([...mumin.map(award => award.studentId), ...mum.map(award => award.pointsStudentId).filter(Boolean), ...credits.map(row => row.studentId), ...links.map(row => row.studentId)])];
  const students = await db.studentProfile.findMany({ where: { id: { in: studentIds } }, select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } }, houseMembership: { select: { qabilaGroup: true } } } });
  const student = id => {
    const found = students.find(item => item.id === id);
    return { studentId: id, name: found?.displayName || (found ? `${found.user.firstName} ${found.user.lastName || ''}`.trim() : 'Unknown'), qabila: found?.houseMembership?.qabilaGroup || 'Unassigned' };
  };
  const awards = [...mumin, ...mum].map(award => {
    const parent = 'parentId' in award;
    const sourceType = parent ? 'PARENT_RECOGNITION_MUM_OF_WEEK' : 'RECOGNITION_MUMIN_OF_WEEK';
    const ledger = credits.filter(row => row.sourceId === award.id && row.sourceType === sourceType);
    const recordedPoints = ledger.reduce((sum, row) => sum + row.points, 0);
    const expectedPoints = award.isPublic && !award.revokedAt ? 150 : 0;
    const familyChildren = parent ? [...new Set(links.filter(link => link.parentId === award.parentId).map(link => link.studentId))]
      .filter(id => students.find(item => item.id === id)?.houseMembership?.qabilaGroup?.trim()).sort() : [award.studentId];
    const expectedShares = expectedPoints ? familyChildren.map((id,index) => ({ ...student(id), points: Math.floor(150 / familyChildren.length) + (index < 150 % familyChildren.length ? 1 : 0) })) : [];
    const distributionMatches = expectedShares.every(share => ledger.filter(row => row.studentId === share.studentId).reduce((sum,row) => sum + row.points,0) === share.points)
      && ledger.every(row => expectedShares.some(share => share.studentId === row.studentId));
    return { awardId: award.id, title: award.title, recipientName: award.recipientName, isPublic: award.isPublic, revokedAt: award.revokedAt, awardedAt: award.awardedAt, expectedPoints, recordedPoints,
      status: recordedPoints === expectedPoints && distributionMatches ? 'OK' : expectedPoints ? 'CREDIT_MISMATCH' : 'PRIVATE_OR_REVOKED_HAS_CREDIT',
      expectedShares,
      selectedChild: parent ? (award.pointsStudentId ? student(award.pointsStudentId) : null) : student(award.studentId),
      linkedChildren: parent ? links.filter(link => link.parentId === award.parentId).map(link => student(link.studentId)) : [],
      credits: ledger.map(row => ({ ...student(row.studentId), points: row.points, awardedAt: row.awardedAt })) };
  });
  console.log(JSON.stringify({ mode: 'read-only', limit: 'Latest 1000 certificates of each kind', summary: { certificates: awards.length, publishedWithMissingOrIncorrectCredit: awards.filter(award => award.status === 'CREDIT_MISMATCH').length, privateOrRevokedWithCredit: awards.filter(award => award.status === 'PRIVATE_OR_REVOKED_HAS_CREDIT').length }, awards }, null, 2));
} catch {
  console.error('Certificate check failed. Verify the deployment, database connection and migrations in App Platform. No records were changed.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
