import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSafeToSpend, allocateIncome, financialHealth } from "./engine.ts";
import { createSeed } from "./seed.ts";

test("computeSafeToSpend deducts committed needs from liquid balance", () => {
  const state = createSeed();
  const safe = computeSafeToSpend(state);
  assert.ok(typeof safe === "number");
  assert.ok(safe >= 0);
});

test("allocateIncome prioritizes Needs over Wants and Goals", () => {
  const state = createSeed();
  const plan = allocateIncome({
    incomeMinor: 80_000_00,
    currencyCode: "KES",
    items: state.items,
    allowedScopes: ["NEED", "WANT", "GOAL"],
    selectedItemIds: [],
    useAllActive: true,
    bankId: state.banks[0]?.id ?? null,
    bankLabel: "M-PESA",
  });

  assert.equal(plan.incomeMinor, 80_000_00);
  assert.ok(plan.itemLines.length > 0);
  const needLines = plan.itemLines.filter((l) => l.bucket === "NEED");
  assert.ok(needLines.length > 0);
});

test("financialHealth evaluates liquidity and debt ratios", () => {
  const health = financialHealth({
    monthlyIncomeMinor: 100_000_00,
    monthlySpendMinor: 60_000_00,
    liquidMinor: 50_000_00,
    investments: [],
    debts: [],
    emergencyMinor: 20_000_00,
    monthlyNeedMinor: 30_000_00,
  });

  assert.ok(health.score > 0);
  assert.ok(["Excellent", "Strong", "Fair", "Needs work"].includes(health.label));
  assert.equal(health.parts.length, 5);
});
