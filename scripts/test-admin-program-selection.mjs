import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
function load(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => { if (name === 'server-only') return {}; if (!(name in dependencies)) throw Error(name); return dependencies[name]; } });
  return exports;
}
const policy = load('src/lib/admin/program-selection.ts');
const offers = [{ slug: 'arabic', programSlugs: ['arabic', 'tajweed'] }, { slug: 'seerah', programSlugs: ['seerah'] }, { slug: 'full', programSlugs: ['arabic', 'tajweed', 'seerah', 'life-lessons'] }];
test('multiple offers combine programme access and reject overlap or empty selections', () => {
  assert.equal(policy.validateAdminProgramSelection(['arabic', 'seerah'], offers).join(','), 'arabic,tajweed,seerah');
  assert.throws(() => policy.validateAdminProgramSelection(['arabic', 'full'], offers), /overlap/);
  assert.throws(() => policy.validateAdminProgramSelection([], offers), /at least one/);
  assert.throws(() => policy.validateAdminProgramSelection(['missing'], offers), /unavailable/);
});
test('PKMULTI3K only discounts one Pakistani student with two or three programmes', () => {
  const input = { couponCode: 'PKMULTI3K', countryCode: 'PK', studentCount: 1, programSlugs: ['arabic', 'tajweed'] };
  assert.equal(policy.adminMultiProgramDiscount(input), 3000);
  assert.equal(policy.adminMultiProgramDiscount({ ...input, programSlugs: ['arabic', 'tajweed', 'seerah'] }), 3000);
  for (const patch of [{ countryCode: 'GB' }, { studentCount: 2 }, { programSlugs: ['seerah'] }, { programSlugs: offers[2].programSlugs }]) assert.throws(() => policy.adminMultiProgramDiscount({ ...input, ...patch }), /requires/);
  assert.equal(policy.adminMultiProgramDiscount({ ...input, couponCode: '' }), null);
});
test('admin switch creates one combined order with PKR 3000 pricing before checkout', async () => {
  let draft, pricing, metadata, checkoutCalls = 0, paid = 0;
  const student = { id: 's', user: { firstName: 'Child', lastName: 'One' }, age: 9, countryCode: 'PK', countryName: 'Pakistan', registrationStudents: [], parents: [{ parent: { user: { firstName: 'Parent', email: 'parent@example.test', phoneCountryCode: '+92', phoneNumber: '3000000000' }, students: [{ studentId: 's' }], billingCountryCode: 'PK', billingCountryName: 'Pakistan' } }] };
  const db = { user: { findUnique: async () => ({ role: 'ADMIN', status: 'ACTIVE' }) }, offer: { findMany: async () => offers.slice(0, 2).map(o => ({ slug: o.slug, programs: o.programSlugs.map(slug => ({ program: { slug } })) })) }, studentProfile: { findMany: async () => [student] }, registration: { update: async input => { pricing = input.data; } }, order: { findUnique: async () => ({ metadata: {} }), update: async input => { metadata = input.data.metadata; } } };
  const service = load('src/lib/admin/program-enrollment.ts', { '@/lib/admin/program-selection': policy, '@/lib/db': { db }, '@/lib/registration/service': { createRegistrationDraft: async input => { draft = input; return { id: 'r', selectedCurrency: 'PKR', subtotalAmount: 10000, pricingSnapshot: {} }; } }, '@/lib/registration/payment-service': { createCheckoutDraft: async () => { checkoutCalls++; assert.equal(pricing.totalAmount, 3000); assert.equal(pricing.pricingSnapshot.couponDiscountAmount, 7000); return { orderId: 'o' }; } }, '@/lib/payments/fulfillment': { markOrderPaid: async () => { paid++; } } });
  const input = { studentId: 's', offerSlugs: ['arabic', 'seerah'], changeMode: 'switch', paymentMode: 'MANUAL_REVIEW', gateway: 'BANK_TRANSFER', couponCode: ' pkmulti3k ', adminUserId: 'admin' };
  await service.createAdminProgramEnrollmentOrder(input);
  assert.equal(draft.students[0].selectedOfferSlugs.join(','), 'arabic,seerah');
  assert.equal(draft.couponCode, '');
  assert.equal(metadata.adminProgramChange.offerSlugs.join(','), 'arabic,seerah');
  assert.equal(metadata.adminProgramChange.mode, 'switch');
  assert.equal(checkoutCalls, 1); assert.equal(paid, 0);
  await service.createAdminProgramEnrollmentOrder({ ...input, changeMode: 'add', paymentMode: 'AUTO_COMPLETE' });
  assert.equal(metadata.adminProgramChange.mode, 'add'); assert.equal(paid, 1);
  db.user.findUnique = async () => ({ role: 'PARENT', status: 'ACTIVE' });
  await assert.rejects(service.createAdminProgramEnrollmentOrder(input), /administrator/);
});
