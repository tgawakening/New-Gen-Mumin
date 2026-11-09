import { PrismaClient } from '@prisma/client';

// Read-only. Use the deployed app's environment; never paste database credentials.
const raw = process.env.APP_DATABASE_URL || process.env.GEN_MUMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!raw) throw new Error('Run this read-only audit in the deployed app console with its database environment.');
const db = new PrismaClient({ datasources: { db: { url: raw.trim().replace(/^["']|["']$/g, '') } } });
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
try {
  const candidates = await db.studentProfile.findMany({
    where: { OR: [{ displayName: { startsWith: 'Laiba' } }, { user: { firstName: { startsWith: 'Laiba' } } }, { registrationStudents: { some: { firstName: { startsWith: 'Laiba' } } } }] },
    select: {
      id: true, displayName: true, user: { select: { firstName: true, lastName: true, status: true } },
      enrollments: { select: { status: true } },
      parents: { select: { parent: { select: { user: { select: { firstName: true, lastName: true } } } } } },
      registrationStudents: { select: { registration: { select: { parentFirstName: true, parentLastName: true, status: true } } } },
      houseMembership: { select: { qabilaGroup: true, role: true } },
      communityMemberships: { select: { room: { select: { title: true, type: true, isActive: true, genderScope: true } } } },
    },
  });
  const matches = candidates.filter(student => [...student.parents.map(link => link.parent.user), ...student.registrationStudents.map(entry => ({ firstName: entry.registration.parentFirstName, lastName: entry.registration.parentLastName }))].some(parent => ['anumsheikh','anumshaikh'].includes(normalize(parent.firstName + parent.lastName))));
  console.log(JSON.stringify({ mode: 'read-only', matches: matches.map(student => ({
    studentId: student.id, name: student.displayName || `${student.user.firstName} ${student.user.lastName}`.trim(),
    accountStatus: student.user.status, enrollmentStatuses: student.enrollments.map(e => e.status),
    registrationStatuses: student.registrationStudents.map(e => e.registration.status),
    qabila: student.houseMembership?.qabilaGroup ?? null,
    qabilaRooms: student.communityMemberships.filter(m => m.room.type === 'PROJECT_TEAM').map(m => m.room),
    complete: ['Qabila Banu Makhzum','Qabila Banu Zuhra'].includes(student.houseMembership?.qabilaGroup) && student.communityMemberships.some(m => m.room.isActive && m.room.title === student.houseMembership?.qabilaGroup && m.room.genderScope === 'GIRLS'),
  })) }, null, 2));
} catch {
  console.error('Read-only Qabila audit failed. Check the database environment and migration status in the deployed app console.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
