import type {
  AllocationLine,
  AllocationPlan,
  BankAccount,
  BudgetBucket,
  BudgetItem,
  CurrencyDefinition,
  Debt,
  IncomeSource,
  Investment,
  Transaction,
} from "./types.ts";
import { remainingOf, todayIso } from "./money.ts";

function urgencyScore(dueDateIso: string | null, today: string): number {
  if (!dueDateIso) return 1;
  const days = Math.round(
    (new Date(dueDateIso + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
      86_400_000,
  );
  if (days <= 0) return 2.75;
  if (days <= 7) return 2.35;
  if (days <= 30) return 1.85;
  if (days <= 90) return 1.35;
  return 1;
}

function categoryWeight(bucket: BudgetBucket): number {
  switch (bucket) {
    case "NEED":
      return 3;
    case "WANT":
      return 2;
    case "GOAL":
      return 2;
    default:
      return 0;
  }
}

function itemWeight(item: BudgetItem, today: string): number {
  if (!item.active || remainingOf(item) <= 0) return 0;
  const priority = Math.max(1, item.priority);
  const priorityW = 1 + 1 / priority ** 0.8;
  const completion =
    item.targetMinor <= 0 ? 1 : Math.min(1, Math.max(0, item.currentMinor / item.targetMinor));
  const completionW = 1 + (1 - completion) * 0.6;
  return categoryWeight(item.bucket) * priorityW * urgencyScore(item.dueDateIso, today) * completionW;
}

function bufferFor(incomeMinor: number, obligationMinor: number): number {
  if (incomeMinor <= 0 || obligationMinor <= 0) return 0;
  const ratio = incomeMinor / obligationMinor;
  let pct = 0.15;
  if (ratio < 1.05) pct = 0;
  else if (ratio < 1.5) pct = 0.05;
  else if (ratio < 3) pct = 0.1;
  else if (ratio < 6) pct = 0.12;
  const suggested = Math.floor(incomeMinor * pct);
  return Math.min(suggested, Math.floor(incomeMinor * 0.2));
}

function redistribute(poolMinor: number, items: BudgetItem[], today: string): Record<number, number> {
  let pool = Math.max(0, poolMinor);
  const allocations: Record<number, number> = {};
  let working = items.filter((i) => remainingOf(i) > 0);

  while (pool > 0 && working.length > 0) {
    if (working.length === 1) {
      const item = working[0];
      const cap = remainingOf(item) - (allocations[item.id] ?? 0);
      const grant = Math.min(pool, cap);
      allocations[item.id] = (allocations[item.id] ?? 0) + grant;
      pool -= grant;
      break;
    }

    const scored = working.map((item) => {
      const already = allocations[item.id] ?? 0;
      const pseudo = { ...item, currentMinor: item.currentMinor + already };
      return { item, score: itemWeight(pseudo, today) };
    });
    const scoreSum = scored.reduce((s, x) => s + x.score, 0) || working.length;

    const provisional = new Map<number, number>();
    let used = 0;
    for (const { item, score } of scored) {
      const cap = remainingOf(item) - (allocations[item.id] ?? 0);
      if (cap <= 0) continue;
      const share = Math.floor((pool * score) / scoreSum);
      const grant = Math.min(share, cap);
      provisional.set(item.id, grant);
      used += grant;
    }

    if (used === 0) {
      const best = scored.sort((a, b) => b.score - a.score)[0];
      const cap = remainingOf(best.item) - (allocations[best.item.id] ?? 0);
      const grant = Math.min(pool, cap);
      allocations[best.item.id] = (allocations[best.item.id] ?? 0) + grant;
      pool -= grant;
      working = working.filter((i) => remainingOf(i) - (allocations[i.id] ?? 0) > 0);
      continue;
    }

    for (const [id, grant] of provisional) allocations[id] = (allocations[id] ?? 0) + grant;
    pool -= used;

    let remainder = poolMinor - Object.values(allocations).reduce((s, n) => s + n, 0);
    while (remainder > 0 && working.some((i) => remainingOf(i) - (allocations[i.id] ?? 0) > 0)) {
      const best = scored
        .filter((s) => remainingOf(s.item) - (allocations[s.item.id] ?? 0) > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (!best) break;
      allocations[best.item.id] = (allocations[best.item.id] ?? 0) + 1;
      remainder -= 1;
    }
    pool = Math.max(0, poolMinor - Object.values(allocations).reduce((s, n) => s + n, 0));
    working = working.filter((i) => remainingOf(i) - (allocations[i.id] ?? 0) > 0);
  }
  return allocations;
}

function tieredAllocate(items: BudgetItem[], poolMinor: number, today: string) {
  const ordered = items
    .filter((i) => i.active && remainingOf(i) > 0)
    .sort((a, b) => itemWeight(b, today) - itemWeight(a, today) || a.priority - b.priority || a.id - b.id);

  if (ordered.length === 0 || poolMinor <= 0) {
    return { allocations: {} as Record<number, number>, spent: 0, fullyFunded: ordered.length === 0 };
  }

  const totalRemaining = ordered.reduce((s, i) => s + remainingOf(i), 0);
  if (poolMinor >= totalRemaining) {
    const allocations = Object.fromEntries(ordered.map((i) => [i.id, remainingOf(i)]));
    return { allocations, spent: totalRemaining, fullyFunded: true };
  }

  let pool = poolMinor;
  const allocations: Record<number, number> = {};
  let index = 0;
  while (index < ordered.length) {
    const item = ordered[index];
    const remaining = remainingOf(item);
    if (remaining > pool) break;
    allocations[item.id] = remaining;
    pool -= remaining;
    index += 1;
  }
  const tail = ordered.slice(index);
  if (pool > 0 && tail.length > 0) {
    const weighted = redistribute(pool, tail, today);
    for (const [id, amount] of Object.entries(weighted)) {
      const n = Number(id);
      if (amount > 0) allocations[n] = (allocations[n] ?? 0) + amount;
    }
  }
  const spent = Object.values(allocations).reduce((s, n) => s + n, 0);
  return { allocations, spent, fullyFunded: false };
}

function accelerationThreshold(item: BudgetItem, today: string): number {
  const urgency = urgencyScore(item.dueDateIso, today);
  if (urgency >= 2.5) return 0.55;
  if (urgency >= 2.0) return 0.7;
  if (urgency >= 1.5) return 0.82;
  return 0.9;
}

function finishNearlyComplete(goals: BudgetItem[], poolMinor: number, today: string) {
  let pool = Math.max(0, poolMinor);
  const allocations: Record<number, number> = {};
  const candidates = goals
    .filter((g) => g.targetMinor > 0 && remainingOf(g) > 0)
    .filter((g) => g.currentMinor / g.targetMinor >= accelerationThreshold(g, today))
    .sort((a, b) => remainingOf(a) - remainingOf(b) || a.id - b.id);

  for (const goal of candidates) {
    if (pool <= 0) break;
    const cost = remainingOf(goal);
    if (cost <= pool) {
      allocations[goal.id] = cost;
      pool -= cost;
    }
  }
  return { allocations, pool };
}

function allocateGoals(goals: BudgetItem[], poolMinor: number, today: string) {
  if (goals.length === 0 || poolMinor <= 0) {
    return { allocations: {} as Record<number, number>, spent: 0, fullyFunded: goals.length === 0 };
  }
  const totalRemaining = goals.reduce((s, g) => s + remainingOf(g), 0);
  if (poolMinor >= totalRemaining) {
    return {
      allocations: Object.fromEntries(goals.map((g) => [g.id, remainingOf(g)])),
      spent: totalRemaining,
      fullyFunded: true,
    };
  }
  const finished = finishNearlyComplete(goals, poolMinor, today);
  const remainingGoals = goals.filter((g) => !(g.id in finished.allocations));
  const tiered =
    remainingGoals.length > 0 && finished.pool > 0
      ? tieredAllocate(remainingGoals, finished.pool, today)
      : { allocations: {} as Record<number, number>, spent: 0 };
  const combined: Record<number, number> = { ...finished.allocations };
  for (const [id, amt] of Object.entries(tiered.allocations)) {
    const n = Number(id);
    combined[n] = (combined[n] ?? 0) + amt;
  }
  const spent = Object.values(combined).reduce((s, n) => s + n, 0);
  return { allocations: combined, spent, fullyFunded: spent >= totalRemaining };
}

function preFundRecurring(
  items: BudgetItem[],
  poolMinor: number,
  horizonMonths: number,
  today: string,
  currencyCode: string,
): { lines: AllocationLine[]; pool: number } {
  let pool = Math.max(0, poolMinor);
  const recurring = items.filter((i) => i.recurring && remainingOf(i) > 0);
  if (pool <= 0 || recurring.length === 0) return { lines: [], pool };
  const lines: AllocationLine[] = [];
  const ordered = [...recurring].sort((a, b) => (a.dueDateIso ?? "9999").localeCompare(b.dueDateIso ?? "9999"));
  for (const item of ordered) {
    if (pool <= 0) break;
    const perCycle = Math.max(0, item.targetMinor);
    if (perCycle <= 0) continue;
    const cycleSpan = Math.max(1, item.frequencyMonths);
    const cyclesToReserve = Math.max(1, Math.floor(Math.max(1, horizonMonths) / cycleSpan));
    const grant = Math.min(pool, perCycle * cyclesToReserve);
    if (grant <= 0) continue;
    lines.push({
      itemId: item.id,
      label: `${item.label} (future reserve)`,
      bucket: item.bucket,
      kind: "FUTURE",
      amountMinor: grant,
      remainingAfterMinor: remainingOf(item),
      dueDateIso: item.dueDateIso,
      note: `Reserved for ${cyclesToReserve} future cycle(s)`,
    });
    pool -= grant;
  }
  return { lines, pool };
}

function lineFor(
  item: BudgetItem,
  grant: number,
  currencyNote: string,
): AllocationLine {
  const remaining = Math.max(0, remainingOf(item) - grant);
  return {
    itemId: item.id,
    label: item.label,
    bucket: item.bucket,
    kind: "CURRENT",
    amountMinor: grant,
    remainingAfterMinor: remaining,
    dueDateIso: item.dueDateIso,
    note: grant >= remainingOf(item) ? "Fully funded" : currencyNote,
  };
}

export interface AllocateInput {
  incomeMinor: number;
  currencyCode: string;
  items: BudgetItem[];
  allowedScopes: BudgetBucket[];
  selectedItemIds: number[];
  useAllActive: boolean;
  bankId: number | null;
  bankLabel: string | null;
  today?: string;
  futureHorizonMonths?: number;
}

export function allocateIncome(input: AllocateInput): AllocationPlan {
  const today = input.today ?? todayIso();
  const incomeMinor = Math.max(0, input.incomeMinor);
  const selected = input.items
    .filter((i) => i.active && remainingOf(i) > 0)
    .filter((i) => input.allowedScopes.includes(i.bucket))
    .filter(
      (i) =>
        input.useAllActive || input.selectedItemIds.length === 0 || input.selectedItemIds.includes(i.id),
    )
    .sort((a, b) => {
      const order = { NEED: 0, WANT: 1, GOAL: 2, BANK: 3 };
      return order[a.bucket] - order[b.bucket] || a.priority - b.priority || a.id - b.id;
    });

  const obligation = selected.reduce((s, i) => s + remainingOf(i), 0);
  const bufferMinor = bufferFor(incomeMinor, obligation);
  const notes: string[] = [];
  const lines: AllocationLine[] = [];
  if (bufferMinor > 0) {
    notes.push("Buffer held back automatically.");
    lines.push({
      itemId: null,
      label: "Buffer",
      bucket: "BANK",
      kind: "BUFFER",
      amountMinor: bufferMinor,
      remainingAfterMinor: 0,
      dueDateIso: null,
      note: "Adaptive safety reserve",
    });
  }
  let pool = Math.max(0, incomeMinor - bufferMinor);

  if (selected.length === 0) {
    const bankLine =
      input.bankId != null && pool > 0
        ? {
            itemId: input.bankId,
            label: input.bankLabel ?? "Selected bank",
            bucket: "BANK" as const,
            kind: "BANK" as const,
            amountMinor: pool,
            remainingAfterMinor: 0,
            dueDateIso: null,
            note: "Surplus destination",
          }
        : null;
    notes.push(bankLine ? "No selected items matched; surplus goes to bank." : "No selected items matched.");
    return { incomeMinor, currencyCode: input.currencyCode, bufferMinor, itemLines: lines, bankLine, notes };
  }

  const needs = selected.filter((i) => i.bucket === "NEED");
  const wants = selected.filter((i) => i.bucket === "WANT");
  const goals = selected.filter((i) => i.bucket === "GOAL");

  const needsResult = tieredAllocate(needs, pool, today);
  for (const item of needs) {
    const grant = needsResult.allocations[item.id] ?? 0;
    if (grant > 0) lines.push(lineFor(item, grant, "Weighted allocation"));
  }
  pool -= needsResult.spent;
  if (needs.length) {
    notes.push(
      needsResult.fullyFunded
        ? "All selected needs were fully funded first."
        : "Needs couldn't all be fully funded, so weighted allocation activated for needs.",
    );
  }

  const wantsResult = tieredAllocate(wants, pool, today);
  for (const item of wants) {
    const grant = wantsResult.allocations[item.id] ?? 0;
    if (grant > 0) lines.push(lineFor(item, grant, "Weighted allocation"));
  }
  pool -= wantsResult.spent;
  if (wants.length) {
    notes.push(
      wantsResult.fullyFunded
        ? "All selected wants were fully funded."
        : "Wants were weighted since needs took priority over the available pool.",
    );
  }

  const goalsResult = allocateGoals(goals, pool, today);
  for (const item of goals) {
    const grant = goalsResult.allocations[item.id] ?? 0;
    if (grant > 0) lines.push(lineFor(item, grant, "Weighted allocation"));
  }
  pool -= goalsResult.spent;
  if (goals.length) {
    notes.push(
      goalsResult.fullyFunded
        ? "All selected goals were fully funded."
        : "Goals near completion were finished first; the rest were weighted.",
    );
  }

  const stillOpen = goals.filter((g) => (goalsResult.allocations[g.id] ?? 0) < remainingOf(g));
  const future = preFundRecurring(selected, pool, input.futureHorizonMonths ?? 2, today, input.currencyCode);
  if (future.lines.length) notes.push("Future periods were pre-funded for recurring items.");
  lines.push(...future.lines);
  pool = future.pool;

  if (pool > 0 && stillOpen.length) {
    const finished = finishNearlyComplete(
      stillOpen.map((g) => ({
        ...g,
        currentMinor: g.currentMinor + (goalsResult.allocations[g.id] ?? 0),
      })),
      pool,
      today,
    );
    if (Object.keys(finished.allocations).length) {
      notes.push("Surplus finished off nearly-complete goals instead of splitting it thin.");
      for (const [id, amount] of Object.entries(finished.allocations)) {
        const goal = stillOpen.find((g) => g.id === Number(id));
        if (!goal) continue;
        lines.push({
          itemId: goal.id,
          label: `${goal.label} (goal completed)`,
          bucket: "GOAL",
          kind: "CURRENT",
          amountMinor: amount,
          remainingAfterMinor: 0,
          dueDateIso: goal.dueDateIso,
          note: "Finished with surplus",
        });
      }
    }
    pool = finished.pool;
  }

  const bankLine =
    input.bankId != null && pool > 0
      ? {
          itemId: input.bankId,
          label: input.bankLabel ?? "Selected bank",
          bucket: "BANK" as const,
          kind: "BANK" as const,
          amountMinor: pool,
          remainingAfterMinor: 0,
          dueDateIso: null,
          note: "Surplus destination",
        }
      : null;
  if (bankLine) notes.push("Surplus routed to selected bank.");
  else if (pool > 0) notes.push("Surplus left unassigned because no bank account was selected.");

  return { incomeMinor, currencyCode: input.currencyCode, bufferMinor, itemLines: lines, bankLine, notes };
}

export function resolveSelection(
  source: IncomeSource | null,
  requested: { allowedScopes: BudgetBucket[]; selectedItemIds: number[]; bankId: number | null; useAllActive: boolean },
) {
  if (!source) return requested;
  const explicit = requested.selectedItemIds.length > 0 || !requested.useAllActive;
  if (explicit) return { ...requested, bankId: requested.bankId ?? source.defaultBankId };
  return {
    allowedScopes: source.allowedScopes,
    selectedItemIds: source.selectedItemIds,
    bankId: requested.bankId ?? source.defaultBankId,
    useAllActive: source.selectedItemIds.length === 0,
  };
}

export function buildReceipt(sourceLabel: string, plan: AllocationPlan): string {
  const money = (n: number) =>
    `${plan.currencyCode} ${(n / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows = [
    sourceLabel,
    `Income: ${money(plan.incomeMinor)}`,
    plan.bufferMinor > 0 ? `Buffer: ${money(plan.bufferMinor)}` : null,
    ...plan.itemLines.map((line) => {
      const prefix =
        line.kind === "CURRENT" ? "Paid" : line.kind === "FUTURE" ? "Reserved" : line.kind === "BUFFER" ? "Held" : "Sent";
      return `${prefix} ${line.label}: ${money(line.amountMinor)}`;
    }),
    plan.bankLine ? `Bank transfer to ${plan.bankLine.label}: ${money(plan.bankLine.amountMinor)}` : null,
    ...plan.notes,
  ];
  return rows.filter(Boolean).join("\n");
}

export function convertToKes(
  amountMinor: number,
  currencyCode: string,
  currencies: CurrencyDefinition[],
  fxOverride?: number,
): { minor: number; rate: number } {
  if (currencyCode.toUpperCase() === "KES") return { minor: amountMinor, rate: 1 };
  const def = currencies.find((c) => c.code === currencyCode.toUpperCase());
  const rate = fxOverride && fxOverride > 0 ? fxOverride : (def?.rateToBase ?? 1);
  const decimals = def?.decimalPlaces ?? 2;
  const major = amountMinor / 10 ** decimals;
  return { minor: Math.max(0, Math.round(major * rate * 100)), rate };
}

export interface HealthBreakdown {
  score: number;
  label: "Excellent" | "Strong" | "Fair" | "Needs work";
  parts: { key: string; label: string; score: number; detail: string }[];
}

export function financialHealth(input: {
  monthlyIncomeMinor: number;
  monthlySpendMinor: number;
  liquidMinor: number;
  investments: Investment[];
  debts: Debt[];
  emergencyMinor: number;
  monthlyNeedMinor: number;
}): HealthBreakdown {
  const savingsRate =
    input.monthlyIncomeMinor <= 0
      ? 0
      : Math.max(0, (input.monthlyIncomeMinor - input.monthlySpendMinor) / input.monthlyIncomeMinor);
  const savingsScore = Math.min(100, Math.round((savingsRate / 0.2) * 100));
  const savingsDetail =
    savingsRate >= 0.2
      ? `You're saving ${(savingsRate * 100).toFixed(0)}% of income — above the 20% mark.`
      : `Savings rate is ${(savingsRate * 100).toFixed(0)}%. Aim for 20% of take-home.`;

  const monthsCovered = input.monthlyNeedMinor > 0 ? input.emergencyMinor / input.monthlyNeedMinor : 0;
  const emergencyScore = Math.min(100, Math.round((monthsCovered / 4) * 100));
  const emergencyDetail =
    monthsCovered >= 6
      ? `Emergency fund covers ${monthsCovered.toFixed(1)} months.`
      : `Emergency fund covers ${monthsCovered.toFixed(1)} months. Six is the calm number.`;

  const netWorth =
    input.liquidMinor +
    input.investments.reduce((s, i) => s + i.valueMinor, 0) +
    input.emergencyMinor;
  const debtTotal = input.debts.reduce((s, d) => s + d.remainingMinor, 0);
  const debtRatio = netWorth > 0 ? debtTotal / netWorth : debtTotal > 0 ? 1 : 0;
  const debtScore = Math.min(100, Math.round((1 - Math.min(1, debtRatio / 0.4)) * 100));
  const debtDetail =
    debtTotal <= 0
      ? "No outstanding debt."
      : debtRatio < 0.15
        ? "Debt is a small slice of your net position."
        : "Debt is still manageable, but worth paying down first.";

  const spendRatio =
    input.monthlyIncomeMinor > 0 ? input.monthlySpendMinor / input.monthlyIncomeMinor : 1;
  const spendScore = Math.min(100, Math.round((1 - Math.min(1, Math.max(0, spendRatio - 0.5) / 0.4)) * 100));
  const spendDetail =
    spendRatio <= 0.55
      ? "Spending is well inside your income."
      : "Spending is eating a large share of income this month.";

  const cashFlow = input.monthlyIncomeMinor - input.monthlySpendMinor;
  const cashScore = cashFlow > 0 ? Math.min(100, 70 + Math.round((cashFlow / Math.max(input.monthlyIncomeMinor, 1)) * 80)) : 35;
  const cashDetail =
    cashFlow > 0
      ? "Cash flow is positive this month."
      : "Cash flow is negative — income isn't covering spend yet.";

  const parts = [
    { key: "savings", label: "Savings rate", score: savingsScore, detail: savingsDetail },
    { key: "emergency", label: "Emergency fund", score: emergencyScore, detail: emergencyDetail },
    { key: "debt", label: "Debt ratio", score: debtScore, detail: debtDetail },
    { key: "spend", label: "Spending habits", score: spendScore, detail: spendDetail },
    { key: "cash", label: "Cash flow", score: cashScore, detail: cashDetail },
  ];
  const score = Math.round(parts.reduce((s, p) => s + p.score, 0) / parts.length);
  const label: HealthBreakdown["label"] =
    score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 50 ? "Fair" : "Needs work";
  return { score, label, parts };
}

export function estimateGoalCompletion(item: BudgetItem, today = todayIso()): string {
  const remaining = remainingOf(item);
  if (remaining <= 0) return "Goal complete";
  if (item.dueDateIso) {
    const days = Math.round(
      (new Date(item.dueDateIso + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
        86_400_000,
    );
    if (days > 1) return `Due in ${days} days`;
    if (days === 1) return "Due tomorrow";
    if (days === 0) return "Due today";
    return "Past due date";
  }
  const created = new Date(item.createdAt);
  const daysSince = Math.max(
    1,
    Math.round((new Date(today + "T00:00:00").getTime() - created.getTime()) / 86_400_000),
  );
  if (item.currentMinor <= 0) return "Add funds to see a completion estimate";
  const daily = item.currentMinor / daysSince;
  if (daily <= 0) return "Add funds to see a completion estimate";
  const daysRemaining = Math.ceil(remaining / daily);
  if (daysRemaining < 30) return `Estimated completion in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const months = Math.ceil(daysRemaining / 30);
  return `Estimated completion in ~${months} month${months === 1 ? "" : "s"}`;
}

export function estimateDebtPayoff(debt: Debt, today = todayIso()): string {
  if (debt.remainingMinor <= 0) return "Paid off";
  if (debt.paymentMinor <= 0) return "Set a repayment to see a date";
  const months = Math.max(1, Math.ceil(debt.remainingMinor / debt.paymentMinor) - 1);
  const d = new Date(today + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  const label = d.toLocaleString("en-KE", { month: "long" });
  if (months <= 1) return `At your current repayment rate, you'll finish this around ${label}.`;
  return `At your current repayment rate, you'll finish this around ${label}.`;
}

export function categorySpend(
  transactions: Transaction[],
  category: string,
  month: string,
): number {
  return transactions
    .filter((t) => t.kind === "expense" && t.category === category && t.isoDate.startsWith(month))
    .reduce((s, t) => s + t.amountMinor, 0);
}

export function computeSafeToSpend(state: { banks: BankAccount[]; prefs: { minReserveMinor?: number }; items: BudgetItem[] }, now = new Date()): number {
  const liquid = state.banks.filter((b) => b.active).reduce((s, b) => s + b.balanceMinor, 0);
  const fulizaDebt = state.banks.reduce((s, b) => s + (b.fulizaOutstandingMinor ?? 0), 0);
  const minReserve = state.prefs.minReserveMinor ?? 0;

  const upcomingNeeds = state.items
    .filter((i) => i.active && i.bucket === "NEED")
    .reduce((s, i) => s + Math.max(0, i.targetMinor - i.currentMinor), 0);

  return Math.max(0, liquid - fulizaDebt - minReserve - upcomingNeeds);
}
