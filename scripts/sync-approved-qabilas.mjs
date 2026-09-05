import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PAID = ["PAID", "CONVERTED"];
const groups = [
  { qabila: "Qabila Banu Makhzum", members: [
    ["Amna Ali", ["amna ali"]], ["Muntaha", ["muntaha fatima", "muntaha"]], ["Tehreem", ["tehreem khurram", "tehreem"]], ["Anayah", ["anayah khan", "anayah"]], ["Emeena", ["ameena ahmadzi", "emeena", "ameena"]], ["Zainab", ["zainab ali", "zainab"]], ["Amal", ["amal salihah", "amal"]], ["Adan", ["adan fakihah", "adan"]],
  ]},
  { qabila: "Qabila Banu Zuhra", members: [
    ["Mishal", ["mishal ahmad", "mishal"]], ["Rania", ["rania osman", "rania"]], ["Noor", ["noor"]], ["Sarah Ali", ["sarah mehboob"]], ["Halima", ["halimah zeeshan", "halima", "halimah"]], ["Aram Fatma", ["aram fatima", "aram fatma"]], ["Huda", ["huda ahsan", "huda"]],
  ]},
  { qabila: "Qabila Banu Hashim", members: [
    ["Musa AH Naveed", ["moosa abdulhaadi naveed", "musa ah naveed"]], ["Ibrahim Hassan", ["ibrahim syed hassan", "ibrahim hassan"]], ["Muhammad Talha", ["muhammad talha"]], ["Mussab", ["mohammad mussab ashfaq", "mohammad musab ashfaq"]], ["TaaHaa", ["muhammad taha", "taahaa"]], ["Hanzla", ["hanzala rehman", "hanzla"]],
  ]},
  { qabila: "Qabila Banu Asad", members: [
    ["Yashur", ["yasher muhammad shahbaz", "yashur"]], ["Mustafa", ["mustafa asif mukhtar"]], ["Arham", ["arham khan", "arham"]], ["Zaran", ["zaran nisar", "zaran"]], ["Reyhan", ["rehan khan", "reyhan"]], ["Salar", ["salaar khurram", "salar"]],
  ]},
];
const roles = new Map([["Amna Ali", "CAPTAIN"], ["Muntaha", "VICE_CAPTAIN"], ["Mishal", "CAPTAIN"], ["Rania", "VICE_CAPTAIN"], ["Musa AH Naveed", "CAPTAIN"], ["Ibrahim Hassan", "VICE_CAPTAIN"], ["Yashur", "CAPTAIN"], ["Mustafa", "VICE_CAPTAIN"]]);
const key = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const roomGender = (qabila) => ["Qabila Banu Makhzum", "Qabila Banu Zuhra"].includes(qabila) ? "GIRLS" : "BOYS";

async function roomFor(qabila) {
  const existing = await db.communityRoom.findFirst({ where: { title: qabila, type: "PROJECT_TEAM", isActive: true }, orderBy: { createdAt: "asc" } });
  if (existing) return db.communityRoom.update({ where: { id: existing.id }, data: { genderScope: roomGender(qabila), isReadOnly: false } });
  return db.communityRoom.create({ data: { title: qabila, description: "A supervised Qabila team room for mentor-guided planning, encouragement, and safe community projects. Personal contact details and external links are blocked.", type: "PROJECT_TEAM", visibility: "STUDENTS", genderScope: roomGender(qabila), ageBand: "GENERAL" } });
}

async function main() {
  const rooms = new Map();
  for (const group of groups) rooms.set(group.qabila, await roomFor(group.qabila));
  const students = await db.studentProfile.findMany({
    where: { registrationStudents: { some: { registration: { status: { in: PAID } } } } },
    include: { user: true, houseMembership: true, registrationStudents: { where: { registration: { status: { in: PAID } } }, include: { registration: { select: { status: true, createdAt: true } } }, orderBy: { createdAt: "desc" } } },
  });
  const matched = [];
  for (const group of groups) {
    for (const [requested, aliases] of group.members) {
      const keys = aliases.map(key);
      const candidates = students.filter((student) => student.registrationStudents.some((entry) => keys.includes(key(entry.displayName || `${entry.firstName} ${entry.lastName || ""}`))));
      candidates.sort((a, b) => (b.registrationStudents[0]?.registration.createdAt?.getTime() ?? 0) - (a.registrationStudents[0]?.registration.createdAt?.getTime() ?? 0));
      const student = candidates[0];
      if (!student?.houseMembership) { console.warn(`[qabila-sync] ${requested}: no eligible paid learner with House membership`); continue; }
      const role = roles.get(requested) ?? "MEMBER";
      await db.houseMembership.update({ where: { studentId: student.id }, data: { qabilaGroup: group.qabila, role } });
      await db.communityMembership.deleteMany({ where: { studentId: student.id, room: { type: "PROJECT_TEAM", title: { in: groups.map((item) => item.qabila) } } } });
      await db.communityMembership.create({ data: { roomId: rooms.get(group.qabila).id, studentId: student.id, role } });
      matched.push(`${requested} -> ${student.displayName || student.user.firstName} -> ${group.qabila}`);
    }
  }
  const testStudents = await db.studentProfile.findMany({ include: { user: true } });
  for (const student of testStudents) {
    const identity = key(student.displayName || `${student.user.firstName} ${student.user.lastName || ""}`);
    const qabilas = ["ahmad", "ahmadparent"].includes(identity) ? ["Qabila Banu Hashim", "Qabila Banu Asad"] : ["khadija", "khadijaparent", "khadjia", "khadjiaparent"].includes(identity) ? ["Qabila Banu Zuhra", "Qabila Banu Makhzum"] : [];
    for (const qabila of qabilas) await db.communityMembership.upsert({ where: { roomId_studentId: { roomId: rooms.get(qabila).id, studentId: student.id } }, update: { role: "MEMBER" }, create: { roomId: rooms.get(qabila).id, studentId: student.id, role: "MEMBER" } });
  }
  const lead = await db.user.findUnique({ where: { email: "globalawakeningchannel@gmail.com" } });
  const zuhrah = rooms.get("Qabila Banu Zuhra");
  if (lead && zuhrah) {
    await db.communityRoomSupervisor.deleteMany({ where: { roomId: zuhrah.id } });
    await db.communityRoomSupervisor.create({ data: { roomId: zuhrah.id, userId: lead.id, role: "MENTOR" } });
  }
  console.log(`[qabila-sync] ${matched.length} paid learner assignments synchronized.`);
  matched.forEach((line) => console.log(`[qabila-sync] ${line}`));
}
main().catch((error) => { console.error("[qabila-sync] failed", error); process.exitCode = 1; }).finally(() => db.$disconnect());