import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNaturalLanguageTxn, queryAskWaterfall } from "./intelligence.ts";
import { createSeed } from "./seed.ts";

test("parseNaturalLanguageTxn parses Swahili expense correctly", () => {
  const state = createSeed();
  const parsed = parseNaturalLanguageTxn("Nimetumia 450 kwa matatu", state);
  assert.equal(parsed.kind, "expense");
  assert.equal(parsed.amountMinor, 45000); // KSh 450 = 45000 minor
  assert.equal(parsed.category, "Transport");
});

test("parseNaturalLanguageTxn parses Swahili income correctly", () => {
  const state = createSeed();
  const parsed = parseNaturalLanguageTxn("Nimepata 80k za mshahara", state);
  assert.equal(parsed.kind, "income");
  assert.equal(parsed.amountMinor, 8000000); // KSh 80,000 = 8000000 minor
  assert.equal(parsed.category, "Salary");
});

test("parseNaturalLanguageTxn parses M-Pesa merchant grocery text", () => {
  const state = createSeed();
  const parsed = parseNaturalLanguageTxn("Naivas groceries 3500 M-Pesa", state);
  assert.equal(parsed.kind, "expense");
  assert.equal(parsed.amountMinor, 350000);
  assert.equal(parsed.category, "Food");
});

test("queryAskWaterfall handles 'Can I afford' queries accurately", () => {
  const state = createSeed();
  const res = queryAskWaterfall("Can I afford KSh 5,000?", state);
  assert.ok(res.answer.includes("Yes") || res.answer.includes("afford"));
  assert.ok(res.tone === "good" || res.tone === "warn");
});
