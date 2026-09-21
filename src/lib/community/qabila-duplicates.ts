import "server-only";
import { db } from "@/lib/db";
import { canonicalQabilaName, LEGACY_QABILA_NAMES, QABILA_NAMES } from "@/lib/community/qabilas";

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function learnerIdentity(value: string) {
  const key = normalize(value);
  const aliases: Record<string, string> = {
    ahmadparent: "ahmad", khadjiaparent: "khadija", khadijaparent: "khadija", khadjia: "khadija", khadja: "khadija", khadjaparent: "khadija",
    muntahafatima: "muntaha", muntahaparent: "muntaha",
  };
  return aliases[key] ?? key;
}

export async function loadQabilaCandidates() {
  return db.houseMembership.findMany({
    select: {
      studentId: true, qabilaGroup: true, role: true,
      student: { select: {
        displayName: true, user: { select: { firstName: true, lastName: true } },
        parents: { select: { parentId: true } },
        registrationStudents: {
          orderBy: { createdAt: "desc" },
          select: { firstName: true, lastName: true, dateOfBirth: true,
            registration: { select: { parentProfileId: true, parentEmail: true, status: true,
              order: { select: { id: true, parentId: true, createdAt: true, status: true,
                payments: { where: { status: "SUCCEEDED" }, take: 1, select: { id: true } },
              } },
            } },
          },
        },
      } },
    },
  });
}

type Candidate = Awaited<ReturnType<typeof loadQabilaCandidates>>[number];
export function planQabilaDuplicates(candidates: Candidate[]) {
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const registrations = candidate.student.registrationStudents;
    const families = new Set(registrations.map((entry) => entry.registration.order?.parentId || entry.registration.parentProfileId || entry.registration.parentEmail.trim().toLowerCase()).filter(Boolean));
    if (!families.size && candidate.student.parents.length === 1) families.add(candidate.student.parents[0].parentId);
    if (families.size !== 1) continue;
    const names = new Set(registrations.map((entry) => learnerIdentity([entry.firstName, entry.lastName].filter(Boolean).join(" "))).filter(Boolean));
    if (!names.size) names.add(learnerIdentity(candidate.student.displayName || [candidate.student.user.firstName, candidate.student.user.lastName].filter(Boolean).join(" ")));
    if (names.size !== 1 || ![...names][0]) continue;
    const key = JSON.stringify([[...families][0], [...names][0]]);
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  const plans: Array<{ keep: Candidate; remove: Candidate[]; qabila: string; role: string }> = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const assigned = group.filter((entry) => canonicalQabilaName(entry.qabilaGroup));
    const qabilas = new Set(assigned.map((entry) => canonicalQabilaName(entry.qabilaGroup)!));
    if (qabilas.size !== 1) continue;
    const birthDates = new Set(group.flatMap((entry) => entry.student.registrationStudents.flatMap((registration) => registration.dateOfBirth ? [registration.dateOfBirth.toISOString().slice(0, 10)] : [])));
    if (birthDates.size > 1) continue;
    const latest = (entry: Candidate) => Math.max(-1, ...entry.student.registrationStudents.map(({ registration }) => {
      const order = registration.order;
      return order && (order.status === "SUCCEEDED" || order.payments.length > 0 || ["PAID", "CONVERTED"].includes(registration.status)) ? order.createdAt.getTime() : -1;
    }));
    const ranked = [...group].sort((a, b) => latest(b) - latest(a));
    if (latest(ranked[0]) < 0 || latest(ranked[0]) === latest(ranked[1])) continue;
    const keep = ranked[0];
    const remove = group.filter((entry) => entry.studentId !== keep.studentId);
    const role = assigned.some((entry) => entry.role === "CAPTAIN") ? "CAPTAIN" : assigned.some((entry) => entry.role === "VICE_CAPTAIN") ? "VICE_CAPTAIN" : keep.role;
    plans.push({ keep, remove, qabila: [...qabilas][0], role });
  }
  return plans;
}

export async function repairQabilaDuplicates() {
  // Only called after admin authentication. No accounts, orders or point entries are deleted.
  const plans = planQabilaDuplicates(await loadQabilaCandidates());
  for (const plan of plans) {
    if (!plan.remove.some((entry) => entry.qabilaGroup) && plan.keep.qabilaGroup === plan.qabila && plan.keep.role === plan.role) continue;
    await db.$transaction(async (tx) => {
      for (const entry of [plan.keep, ...plan.remove]) {
        const updated = await tx.houseMembership.updateMany({
          where: { studentId: entry.studentId, qabilaGroup: entry.qabilaGroup, role: entry.role },
          data: entry.studentId === plan.keep.studentId ? { qabilaGroup: plan.qabila, role: plan.role } : { qabilaGroup: null, role: "MEMBER" },
        });
        if (updated.count !== 1) throw new Error("Qabila memberships changed. Please refresh and try again.");
      }
      await tx.communityMembership.deleteMany({ where: { studentId: { in: plan.remove.map((entry) => entry.studentId) }, room: { type: "PROJECT_TEAM", title: { in: [...QABILA_NAMES, ...LEGACY_QABILA_NAMES] } } } });
    });
  }
}

export async function isSupersededQabilaLearner(studentId: string) {
  const candidates = await loadQabilaCandidates();
  return planQabilaDuplicates(candidates).some((plan) => plan.remove.some((entry) => entry.studentId === studentId));
}
