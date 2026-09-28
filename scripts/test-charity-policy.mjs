import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import fs from "node:fs";
import vm from "node:vm";
const output = ts.transpileModule(fs.readFileSync("src/lib/payments/charity-policy.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {}; vm.runInNewContext(output, { exports, Date });
const { charityClassification, isCharityReceipt } = exports;
const metadata = { tgaCharity: { effectiveAt: "2026-09-28T00:00:00Z", includeOriginalPayment: false } };
test("ordinary payments are never charity", () => { for (const value of [null, {}, [], { tgaCharity: {} }, { tgaCharity: { effectiveAt: "invalid" } }]) assert.equal(charityClassification(value), null); });
test("late historical events stay course payments", () => assert.equal(isCharityReceipt(metadata, new Date("2026-09-27T23:59:59Z")), false));
test("future recurring receipts become charity at effective boundary", () => assert.equal(isCharityReceipt(metadata, new Date("2026-09-28T00:00:00Z")), true));
test("historical receipt reclassification is explicit", () => { assert.equal(charityClassification(metadata).includeOriginalPayment, false); assert.equal(charityClassification({ tgaCharity: { ...metadata.tgaCharity, includeOriginalPayment: true } }).includeOriginalPayment, true); });

function service(db) {
  const result = {}; const code = ts.transpileModule(fs.readFileSync("src/lib/payments/charity.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports: result, Date, require(name) { if (name === "server-only" || name === "@prisma/client") return {}; if (name === "@/lib/db") return { db }; if (name === "@/lib/payments/charity-policy") return exports; throw new Error(name); } });
  return result.recordCharitySubscriptionPayment;
}
test("renewals without course enrolments enter charity once on replay", async () => {
  const records = new Map();
  const record = service({ subscription: { findUnique: async () => ({ orderItem: { order: { id: "o", metadata, totalAmount: 20, currency: "GBP" } } }) }, charityPayment: { upsert: async ({ where, create }) => { if (!records.has(where.sourceKey)) records.set(where.sourceKey, create); } } });
  const input = { providerSubscriptionId: "sub", providerInvoiceId: "payment1", amount: 20.25, gateway: "PAYPAL", paidAt: new Date("2026-09-29") };
  assert.equal(await record(input), true); assert.equal(await record(input), true);
  assert.equal(records.size, 1); assert.equal([...records.values()][0].amount, 20.25);
  assert.equal([...records.values()][0].status, "SUCCEEDED");
});
test("ordinary subscriptions fall through without charity writes", async () => {
  const record = service({ subscription: { findUnique: async () => ({ orderItem: { order: { metadata: null } } }) } });
  assert.equal(await record({ providerSubscriptionId: "sub", gateway: "PAYPAL" }), false);
});
test("charity events lacking stable reference are rejected", async () => {
  const record = service({ subscription: { findUnique: async () => ({ orderItem: { order: { metadata } } }) } });
  await assert.rejects(record({ providerSubscriptionId: "sub", gateway: "PAYPAL", paidAt: new Date("2026-09-29") }), /reference/);
});
test("failed contributions do not count as paid receipts", async () => {
  let saved;
  const record = service({ subscription: { findUnique: async () => ({ orderItem: { order: { id: "o", metadata, totalAmount: 20, currency: "GBP" } } }) }, charityPayment: { upsert: async ({ create }) => { saved = create; } } });
  await record({ providerSubscriptionId: "sub", providerInvoiceId: "failure1", gateway: "PAYPAL", failedAt: new Date("2026-09-29") }, true);
  assert.equal(saved.status, "FAILED"); assert.equal(saved.paidAt, null);
});

test("charity orders cannot reactivate course access", async () => {
  const result = {};
  const code = ts.transpileModule(fs.readFileSync("src/lib/enrollment/access.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const db = { order: { findUnique: async () => ({ registrationId: "r", metadata }) }, $transaction: async () => { throw new Error("Unexpected course write"); } };
  vm.runInNewContext(code, { exports: result, require(name) { if (name === "@prisma/client") return {}; if (name === "@/lib/db") return { db }; if (name === "@/lib/payments/charity-policy") return exports; throw new Error(name); } });
  await result.activateOrderEnrollments("o"); await result.syncRegistrationAccess("r", "ACTIVE");
});
test("replayed checkout activation cannot rewrite charity commitment or send course emails", async () => {
  const result = {};
  const code = ts.transpileModule(fs.readFileSync("src/lib/payments/fulfillment.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const db = { order: { findUnique: async () => ({ metadata }) } };
  vm.runInNewContext(code, { exports: result, require(name) { if (name === "@/lib/db") return { db }; if (name === "@/lib/payments/charity-policy") return exports; return {}; } });
  await result.markOrderPaid("o", { subscriptionId: "sub" });
});
