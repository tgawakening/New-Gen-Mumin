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
        displayName: true, createdAt: true, user: { select: { firstName: true, lastName: true } },
        parents: { select: { parentId: true, parent: { select: { user: { select: { email: true, firstName: true, lastName: true } } } } } },
        enrollments: { select: { orderItems: { select: { order: { select: {
          id: true, parentId: true, createdAt: true, status: true,
          parent: { select: { user: { select: { email: true, firstName: true, lastName: true } } } },
          registration: { select: { status: true } },
          payments: { where: { status: "SUCCEEDED" }, take: 1, select: { id: true } },
        } } } } } },
        registrationStudents: {
          orderBy: { createdAt: "desc" },
          select: { firstName: true, lastName: true, dateOfBirth: true,
            registration: { select: { parentProfileId: true, parentEmail: true, parentFirstName: true, parentLastName: true, status: true,
              order: { select: { id: true, parentId: true, createdAt: true, status: true,
                parent: { select: { user: { select: { email: true, firstName: true, lastName: true } } } },
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
function completedOrders(candidate: Candidate) {
  const registrationOrders = candidate.student.registrationStudents.flatMap(({ registration }) => {
    const order = registration.order;
    return order && (order.status === "SUCCEEDED" || order.payments.length > 0 || ["PAID", "CONVERTED"].includes(registration.status)) ? [order] : [];
  });
  const enrollmentOrders = candidate.student.enrollments.flatMap((entry) => entry.orderItems.map((item) => item.order))
    .filter((order) => order.status === "SUCCEEDED" || order.payments.length > 0 || ["PAID", "CONVERTED"].includes(order.registration?.status ?? ""));
  return [...registrationOrders, ...enrollmentOrders];
}

export function planQabilaDuplicates(candidates: Candidate[]) {
  // Bridge historic parent IDs to the same email, rather than comparing IDs to emails.
  const parentEmails = new Map<string, string>();
  const email = (value?: string | null) => value?.trim().toLowerCase() || "";
  for (const candidate of candidates) {
    for (const link of candidate.student.parents) {
      const address = email(link.parent.user.email);
      if (address) parentEmails.set(link.parentId, address);
    }
    for (const { registration } of candidate.student.registrationStudents) {
      const address = email(registration.order?.parent.user.email) || email(registration.parentEmail);
      const id = registration.order?.parentId || registration.parentProfileId;
      if (id && address && !parentEmails.has(id)) parentEmails.set(id, address);
    }
    for (const order of completedOrders(candidate)) {
      const address = email(order.parent.user.email);
      if (address) parentEmails.set(order.parentId, address);
    }
  }
  const familyKey = (id: string | null, fallback?: string) => (id && parentEmails.get(id)) || email(fallback) || (id ? "id:" + id : "");
  const confirmedTestFamilies = new Set<string>();
  for (const candidate of candidates) {
    for (const link of candidate.student.parents) {
      if (normalize([link.parent.user.firstName, link.parent.user.lastName].filter(Boolean).join(" ")) === "areejirshad") confirmedTestFamilies.add(familyKey(link.parentId));
    }
    for (const { registration } of candidate.student.registrationStudents) {
      if (normalize([registration.parentFirstName, registration.parentLastName].filter(Boolean).join(" ")) === "areejirshad") confirmedTestFamilies.add(familyKey(registration.order?.parentId || registration.parentProfileId, registration.parentEmail));
    }
  }
  const confirmedTestIds = new Set<string>();
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const registrations = candidate.student.registrationStudents;
    const families = new Set([
      ...registrations.map((entry) => familyKey(entry.registration.order?.parentId || entry.registration.parentProfileId, entry.registration.parentEmail)),
      ...candidate.student.parents.map((entry) => familyKey(entry.parentId)),
      ...completedOrders(candidate).map((order) => familyKey(order.parentId)),
    ].filter(Boolean));
    if (families.size !== 1) continue;
    const displayIdentity = learnerIdentity(candidate.student.displayName || [candidate.student.user.firstName, candidate.student.user.lastName].filter(Boolean).join(" "));
    // The owner explicitly identified these two as repeated test learners.
    const confirmedTest = ["ahmad", "khadija"].includes(displayIdentity) && confirmedTestFamilies.has([...families][0]);
    if (confirmedTest) confirmedTestIds.add(candidate.studentId);
    const names = new Set(registrations.map((entry) => learnerIdentity([entry.firstName, entry.lastName].filter(Boolean).join(" "))).filter(Boolean));
    if (confirmedTest) { names.clear(); names.add(displayIdentity); }
    if (!names.size) names.add(displayIdentity);
    if (names.size !== 1 || ![...names][0]) continue;
    if (!confirmedTest && displayIdentity && displayIdentity !== [...names][0]) continue;
    const key = JSON.stringify([[...families][0], [...names][0]]);
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  const plans: Array<{ keep: Candidate; remove: Candidate[]; qabila: string; role: string }> = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const assigned = group.filter((entry) => canonicalQabilaName(entry.qabilaGroup));
    const qabilas = new Set(assigned.map((entry) => canonicalQabilaName(entry.qabilaGroup)!));
    if (qabilas.size !== 1) continue;
    const confirmedTest = group.every((entry) => confirmedTestIds.has(entry.studentId));
    const birthDates = new Set(group.flatMap((entry) => entry.student.registrationStudents.flatMap((registration) => registration.dateOfBirth ? [registration.dateOfBirth.toISOString().slice(0, 10)] : [])));
    if (!confirmedTest && birthDates.size > 1) continue;
    const latest = (entry: Candidate) => Math.max(-1, ...completedOrders(entry).map((order) => order.createdAt.getTime()));
    const ranked = [...group].sort((a, b) => latest(b) - latest(a) || b.student.createdAt.getTime() - a.student.createdAt.getTime() || a.studentId.localeCompare(b.studentId));
    if (latest(ranked[0]) < 0 || (!confirmedTest && latest(ranked[0]) === latest(ranked[1]))) continue;
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
