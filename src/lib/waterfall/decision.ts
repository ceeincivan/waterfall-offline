import { addDaysIso, daysBetween, formatMoney, monthKey, remainingOf, todayIso } from "./money";
import { applyPeriod, expectedNextIncome, tradeoffAllocate } from "./tradeoff";
import { availableOf, fulizaOutstanding, fulizaSuggestedPayment, nextBirthdayIso, totalFuliza, totalFulizaDaily } from "./fuliza";
import type {
  AllocationLine,
  AllocationPlan,
  BudgetBucket,
  BudgetItem,
  FundingMode,
  WaterfallState,
} from "./types";

export type HumanLane = "Must Pay" | "Lifestyle" | "Goals" | "Reserve";
export type PressureLevel = "critical" | "high" | "normal" | "low";

export interface PressureItem {
  item: BudgetItem;
  days: number | null;
  remainingMinor: number;
  level: PressureLevel;
  score: number;
  reason: string;
}

export interface Outlook {
  coveredUntilIso: string | null;
  headline: string;
  tone: "good" | "warn" | "danger";
  billsCoveredPct: number;
}

export interface SafeToSpend {
  amountMinor: number;
  rangeHighMinor: number | null;
  untilIso: string | null;
  perDayMinor: number;
  committedMinor: number;
  savingsMinor: number;
  liquidMinor: number;
  why: string;
}

export interface Decision {
  plan: AllocationPlan;
  mode: FundingMode;
  confidence: "high" | "medium" | "low";
  confidenceWhy: string;
  explanations: string[];
  lanes: { lane: HumanLane; minor: number }[];
  windfall: boolean;
  nextMove: string;
}

export const INCOME_PRESETS = [
  "Salary",
  "Freelance",
  "Business",
  "Side hustle",
  "Commission",
  "Bonus",
  "Gift",
  "Refund",
  "Other",
] as const;

export const EXPENSE_PRESETS: { label: string; bucket: BudgetBucket; category: string }[] = [
  { label: "Housing", bucket: "NEED", category: "Housing" },
  { label: "Food", bucket: "NEED", category: "Food" },
  { label: "Transport", bucket: "NEED", category: "Transport" },
  { label: "Phone", bucket: "NEED", category: "Phone" },
  { label: "Utilities", bucket: "NEED", category: "Utilities" },
  { label: "Education", bucket: "NEED", category: "Education" },
  { label: "Medical", bucket: "NEED", category: "Medical" },
  { label: "Entertainment", bucket: "WANT", category: "Entertainment" },
  { label: "Travel", bucket: "WANT", category: "Travel" },
  { label: "Savings", bucket: "GOAL", category: "Savings" },
  { label: "Goal", bucket: "GOAL", category: "Goal" },
];

export const FUNDING_MODES: { id: FundingMode; label: string; blurb: string }[] = [
  { id: "SMART", label: "Smart", blurb: "Waterfall decides from pressure, deadlines, and your history." },
  { id: "SAFE", label: "Safe", blurb: "Bills and buffer first. Lifestyle waits." },
  { id: "GROWTH", label: "Growth", blurb: "Essentials, then savings and goals." },
  { id: "BALANCED", label: "Balanced", blurb: "Even progress across lanes." },
  { id: "LIFESTYLE", label: "Lifestyle", blurb: "More room for discretionary spend after bills." },
  { id: "GOAL_RUSH", label: "Goal rush", blurb: "Finish selected goals after essentials." },
  { id: "RECOVERY", label: "Recovery", blurb: "Stability only. Pause wants and stretch goals." },
  { id: "WINDFALL", label: "Windfall", blurb: "Cover a normal month, send the extra to savings." },
];

export function humanLane(bucket: BudgetBucket, kind?: AllocationLine["kind"]): HumanLane {
  if (kind === "BUFFER" || bucket === "BANK") return "Reserve";
  if (bucket === "NEED") return "Must Pay";
  if (bucket === "WANT") return "Lifestyle";
  return "Goals";
}

export function laneOfItem(item: BudgetItem): HumanLane {
  return humanLane(item.bucket);
}

export function pressureFor(item: BudgetItem, today: string): PressureItem {
  const remaining = remainingOf(item);
  const days = item.dueDateIso ? daysBetween(today, item.dueDateIso) : null;
  let score = 10;
  let level: PressureLevel = "normal";
  let reason = "On track.";

  if (item.bucket === "NEED") score += 40;
  if (item.bucket === "GOAL") score += 12;
  if (item.priority <= 1) score += 18;
  else if (item.priority === 2) score += 8;

  if (days != null) {
    if (days <= 2) {
      score += 50;
      level = "critical";
      reason = `Due in ${Math.max(0, days)} day${days === 1 ? "" : "s"}. Missing this has real consequences.`;
    } else if (days <= 7) {
      score += 32;
      level = "high";
      reason = `Due in ${days} days. Fund this before lifestyle.`;
    } else if (days <= 21) {
      score += 16;
      level = item.bucket === "NEED" ? "high" : "normal";
      reason = `Due in ${days} days.`;
    }
  } else if (item.bucket === "NEED" && remaining > 0) {
    score += 12;
    reason = "Recurring essential still unfunded this cycle.";
  }

  const funded = item.targetMinor > 0 ? item.currentMinor / item.targetMinor : 0;
  if (funded < 0.4 && item.bucket === "NEED") score += 10;
  if (funded >= 0.85 && item.bucket === "GOAL") {
    score += 14;
    reason = "Close enough to finish. Completing it now is cheaper than stretching it.";
  }

  if (score >= 80) level = "critical";
  else if (score >= 55) level = "high";
  else if (score >= 30) level = "normal";
  else level = "low";

  if (remaining <= 0) {
    level = "low";
    score = 0;
    reason = "Fully funded.";
  }

  return { item, days, remainingMinor: remaining, level, score, reason };
}

export function liquidOf(state: WaterfallState): number {
  return state.banks
    .filter((b) => b.active && b.purpose !== "SAVINGS" && b.purpose !== "INVESTMENT")
    .reduce((s, b) => s + availableOf(b), 0);
}

export function committedNeeds(state: WaterfallState, today: string, withinDays = 30): number {
  return state.items
    .filter((i) => i.active && i.bucket === "NEED")
    .filter((i) => !i.dueDateIso || daysBetween(today, i.dueDateIso) <= withinDays)
    .reduce((s, i) => s + remainingOf(i), 0);
}

export function savingsOf(state: WaterfallState): number {
  return state.items.filter((i) => i.active && i.bucket === "GOAL").reduce((s, i) => s + i.currentMinor, 0);
}

export function upcoming(state: WaterfallState, today: string, days = 45) {
  return state.items
    .filter((i) => i.active && remainingOf(i) > 0)
    .map((item) => pressureFor(item, today))
    .filter((p) => p.days == null || (p.days >= 0 && p.days <= days))
    .sort((a, b) => b.score - a.score);
}

export function outlook(state: WaterfallState, today: string): Outlook {
  const due = state.items
    .filter((i) => i.active && i.bucket === "NEED" && i.dueDateIso && remainingOf(i) > 0)
    .map((i) => ({ item: i, days: daysBetween(today, i.dueDateIso!) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days);

  const needs = state.items.filter((i) => i.active && i.bucket === "NEED");
  const funded = needs.filter((i) => remainingOf(i) <= 0).length;
  const billsCoveredPct = needs.length ? Math.round((funded / needs.length) * 100) : 100;
  const firstGap = due.find((d) => remainingOf(d.item) > 0);

  if (!firstGap) {
    const owed = totalFuliza(state);
    if (owed > 0) {
      return {
        coveredUntilIso: addDaysIso(30, new Date(today + "T00:00:00")),
        headline: `Bills look covered, but Fuliza ${formatMoney(owed)} is still accruing.`,
        tone: "warn",
        billsCoveredPct,
      };
    }
    return {
      coveredUntilIso: addDaysIso(30, new Date(today + "T00:00:00")),
      headline: "Bills through the next month look covered.",
      tone: "good",
      billsCoveredPct,
    };
  }
  if (firstGap.days <= 3 && remainingOf(firstGap.item) > 0) {
    return {
      coveredUntilIso: firstGap.item.dueDateIso,
      headline: `${firstGap.item.label} is still short and due in ${firstGap.days} day${firstGap.days === 1 ? "" : "s"}.`,
      tone: "danger",
      billsCoveredPct,
    };
  }
  return {
    coveredUntilIso: firstGap.item.dueDateIso,
    headline: `You're covered through ${formatIso(firstGap.item.dueDateIso!)}.`,
    tone: billsCoveredPct >= 80 ? "good" : "warn",
    billsCoveredPct,
  };
}

export function safeToSpend(state: WaterfallState, today = todayIso()): SafeToSpend {
  const items = applyPeriod(state.items, today);
  const liquid = liquidOf({ ...state, items });
  const minReserve = state.prefs.minReserveMinor;
  const next = expectedNextIncome(state.incomeEntries, today, state.profile.payDay, state.profile.incomeFrequency);
  const days = next.iso ? Math.max(1, daysBetween(today, next.iso)) : 21;
  const livingItems = items.filter(
    (i) => i.active && i.bucket === "NEED" && /food|transport|fare/.test(i.label.toLowerCase()),
  );
  const livingIds = new Set(livingItems.map((i) => i.id));
  const billsBeforeNext = items
    .filter((i) => i.active && i.bucket === "NEED" && !livingIds.has(i.id))
    .filter((i) => !i.dueDateIso || daysBetween(today, i.dueDateIso) <= days)
    .reduce((s, i) => s + remainingOf(i), 0);
  const living = livingItems.reduce((s, i) => s + remainingOf(i), 0);
  const livingUntilNext = living;
  const committed = billsBeforeNext + livingUntilNext + minReserve;
  const expectedHelp = !next.irregular && days <= 5 ? Math.min(Math.round(next.minor * 0.15), Math.round(billsBeforeNext * 0.3)) : 0;
  const raw = Math.max(0, liquid - committed + expectedHelp);
  const tightness = state.profile.tightness;
  const haircut = tightness === "crisis" ? 0.4 : tightness === "stretched" ? 0.7 : 1;
  const owed = totalFuliza(state);
  const daily = totalFulizaDaily(state);
  const postHaircut = Math.round(raw * haircut);
  const debtProtected = fulizaSuggestedPayment(owed, postHaircut);
  const amount = Math.max(0, postHaircut - debtProtected);
  const rangeHigh = next.irregular ? Math.round(amount * (amount > 0 ? 2 : 1)) || Math.round(liquid * 0.08) : null;
  const nextNeed = upcoming({ ...state, items }, today, 60).find((p) => p.item.bucket === "NEED" && p.days != null && p.days > 0);
  const untilIso = nextNeed?.item.dueDateIso ?? next.iso;
  const span = untilIso ? Math.max(1, daysBetween(today, untilIso)) : days;
  let why = next.irregular
    ? "Next income is uncertain, so this is a conservative range — not an exact number."
    : `You can use about this much without putting upcoming essentials at risk before ${next.iso ?? "the next income"}.`;
  if (tightness === "crisis") why = "This month is in a hole. This number is only what's left after food and rent.";
  else if (tightness === "stretched") why = "Things are tight. Lifestyle is cut so bills don't slip.";
  if (owed > 0) why += ` Fuliza ${formatMoney(owed)} costs about ${formatMoney(daily)} a day in the current model; ${formatMoney(debtProtected)} is reserved for payoff before discretionary spend.`;
  return {
    amountMinor: amount,
    rangeHighMinor: rangeHigh && rangeHigh !== amount ? Math.max(amount, rangeHigh) : null,
    untilIso,
    perDayMinor: Math.floor(amount / span),
    committedMinor: committed,
    savingsMinor: savingsOf({ ...state, items }),
    liquidMinor: liquid,
    why,
  };
}

export function detectWindfall(state: WaterfallState, amountMinor: number, sourceLabel: string): boolean {
  const hist = state.incomeEntries
    .filter((e) => e.sourceLabel.toLowerCase() === sourceLabel.toLowerCase())
    .slice(0, 6)
    .map((e) => e.amountMinor);
  if (hist.length < 2) return amountMinor >= 200_000_00;
  const median = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
  return median > 0 && amountMinor >= median * 1.6;
}

export function scopesForMode(mode: FundingMode): BudgetBucket[] {
  switch (mode) {
    case "SAFE":
    case "RECOVERY":
      return ["NEED"];
    case "GROWTH":
    case "GOAL_RUSH":
    case "WINDFALL":
      return ["NEED", "GOAL"];
    default:
      return ["NEED", "WANT", "GOAL"];
  }
}

function survivalFloor(item: BudgetItem): number {
  if (item.bucket !== "NEED") return 0;
  const remaining = remainingOf(item);
  return Math.min(remaining, Math.round(item.targetMinor * 0.4));
}

export function decide(state: WaterfallState, input: {
  incomeMinor: number;
  sourceLabel: string;
  bankId: number | null;
  bankLabel?: string;
  mode?: FundingMode;
  selectedItemIds?: number[];
}): Decision {
  const today = todayIso();
  const windfall = detectWindfall(state, input.incomeMinor, input.sourceLabel);
  const tightness = state.profile.tightness;
  const autoMode: FundingMode =
    tightness === "crisis" ? "RECOVERY" : tightness === "stretched" ? "SAFE" : state.prefs.fundingMode;
  const mode: FundingMode = input.mode ?? (windfall ? "WINDFALL" : autoMode);
  const allowed = scopesForMode(mode);
  const bank = state.banks.find((b) => b.id === input.bankId) ?? state.banks.find((b) => b.isDefault);
  const items = applyPeriod(state.items, today).filter((i) => allowed.includes(i.bucket) || i.bucket === "BANK");
  const next = expectedNextIncome(state.incomeEntries, today, state.profile.payDay, state.profile.incomeFrequency);
  const typicals: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.prefs.learnedCaps)) typicals[k] = v;

  let plan = tradeoffAllocate(input.incomeMinor, items, today, {
    nextIncomeIso: next.iso,
    nextIncomeMinor: next.minor,
    irregular: next.irregular || /freelance|gift|bonus|side/.test(input.sourceLabel.toLowerCase()),
    cashFloorMinor: state.prefs.minReserveMinor,
    typicals,
    bankId: bank?.id ?? null,
    bankLabel: input.bankLabel ?? bank?.nickname ?? bank?.bankName ?? "Reserve",
  });

  if (windfall) {
    plan = { ...plan, notes: [...plan.notes, "This is larger than your usual income, so extra went to goals and reserve after the month was covered."] };
  }

  plan = applyGuardrails(state, plan);
  plan = applyLearnedCaps(state, plan);
  plan = applyFulizaPressure(state, plan);
  plan = reconcile(plan);

  const explanations = (plan.notes.length ? plan.notes : explain(state, plan, mode, today)).slice(0, 6);
  const lanes = summariseLanes(plan);
  const history = state.incomeEntries.filter((e) => e.sourceLabel === input.sourceLabel).length;
  const confidence: Decision["confidence"] = history >= 3 ? "high" : history >= 1 ? "medium" : "low";
  const confidenceWhy =
    confidence === "high"
      ? "Your income pattern and upcoming obligations are well established."
      : confidence === "medium"
        ? "Waterfall has some history for this source, but not a long one."
        : "Limited history for this source. Review is recommended.";

  return {
    plan,
    mode,
    confidence,
    confidenceWhy,
    explanations,
    lanes,
    windfall,
    nextMove: nextBestMove(state, today),
  };
}

function typicalAmount(state: WaterfallState, sourceLabel: string): number {
  const hist = state.incomeEntries.filter((e) => e.sourceLabel.toLowerCase() === sourceLabel.toLowerCase()).slice(0, 4);
  if (!hist.length) return 0;
  return Math.round(hist.reduce((s, e) => s + e.amountMinor, 0) / hist.length);
}

function applyGuardrails(state: WaterfallState, plan: AllocationPlan): AllocationPlan {
  const minReserve = state.prefs.minReserveMinor;
  if (minReserve <= 0) return plan;
  const reserveNow = (plan.bufferMinor ?? 0) + (plan.bankLine?.amountMinor ?? 0);
  if (reserveNow >= minReserve) return plan;
  const need = minReserve - reserveNow;
  const lifestyle = plan.itemLines.filter((l) => l.bucket === "WANT" && l.amountMinor > 0);
  let taken = 0;
  const nextLines = plan.itemLines.map((l) => {
    if (l.bucket !== "WANT" || taken >= need) return l;
    const cut = Math.min(l.amountMinor, need - taken);
    taken += cut;
    return { ...l, amountMinor: l.amountMinor - cut, note: "Trimmed to keep your cash floor." };
  });
  if (taken <= 0) return plan;
  return {
    ...plan,
    itemLines: nextLines.filter((l) => l.amountMinor > 0 || l.kind === "BUFFER"),
    bufferMinor: plan.bufferMinor + taken,
    notes: [...plan.notes, `Held ${formatMoney(taken)} so cash never drops below ${formatMoney(minReserve)}.`],
  };
}

function applyLearnedCaps(state: WaterfallState, plan: AllocationPlan): AllocationPlan {
  const caps = state.prefs.learnedCaps;
  if (!Object.keys(caps).length) return plan;
  let released = 0;
  const lines = plan.itemLines.map((l) => {
    const cap = caps[l.label.toLowerCase()];
    if (!cap || l.amountMinor <= cap) return l;
    released += l.amountMinor - cap;
    return { ...l, amountMinor: cap, note: `Remembered: you usually keep this around ${formatMoney(cap)}.` };
  });
  if (released <= 0) return { ...plan, itemLines: lines };
  return {
    ...plan,
    itemLines: lines,
    bufferMinor: plan.bufferMinor + released,
    notes: [...plan.notes, "Lifestyle lines were capped from your previous adjustments."],
  };
}

function reconcile(plan: AllocationPlan): AllocationPlan {
  const allocated =
    plan.itemLines.reduce((s, l) => s + l.amountMinor, 0) + (plan.bankLine?.amountMinor ?? 0);
  const drift = plan.incomeMinor - allocated;
  if (Math.abs(drift) <= 2) return plan;
  if (drift > 0) {
    return {
      ...plan,
      bufferMinor: plan.bufferMinor + drift,
      notes: [...plan.notes, "Remainder parked in reserve so nothing is unexplained."],
    };
  }
  let need = -drift;
  const order: BudgetBucket[] = ["WANT", "GOAL", "NEED"];
  const lines = [...plan.itemLines];
  for (const bucket of order) {
    for (let i = lines.length - 1; i >= 0 && need > 0; i--) {
      if (lines[i].bucket !== bucket) continue;
      const cut = Math.min(lines[i].amountMinor, need);
      lines[i] = { ...lines[i], amountMinor: lines[i].amountMinor - cut };
      need -= cut;
    }
  }
  return { ...plan, itemLines: lines.filter((l) => l.amountMinor > 0) };
}

function summariseLanes(plan: AllocationPlan): { lane: HumanLane; minor: number }[] {
  const acc: Record<HumanLane, number> = { "Must Pay": 0, Lifestyle: 0, Goals: 0, Reserve: 0 };
  for (const l of plan.itemLines) acc[humanLane(l.bucket, l.kind)] += l.amountMinor;
  if (plan.bankLine) acc.Reserve += plan.bankLine.amountMinor;
  acc.Reserve += plan.itemLines.filter((l) => l.kind === "BUFFER").reduce((s, l) => s + l.amountMinor, 0);
  return (Object.keys(acc) as HumanLane[]).map((lane) => ({ lane, minor: acc[lane] })).filter((x) => x.minor > 0);
}

function explain(state: WaterfallState, plan: AllocationPlan, mode: FundingMode, today: string): string[] {
  const out: string[] = [];
  const pressures = upcoming(state, today, 45);
  const topNeed = pressures.find((p) => p.item.bucket === "NEED");
  const needLine = plan.itemLines
    .filter((l) => l.bucket === "NEED")
    .sort((a, b) => b.amountMinor - a.amountMinor)[0];
  if (needLine && topNeed) {
    out.push(
      `${needLine.label} received ${formatMoney(needLine.amountMinor)} because ${topNeed.reason.toLowerCase()}`,
    );
  }
  const goalLine = plan.itemLines.filter((l) => l.bucket === "GOAL").sort((a, b) => b.amountMinor - a.amountMinor)[0];
  if (goalLine) {
    out.push(`${goalLine.label} received ${formatMoney(goalLine.amountMinor)} as your highest-priority long-term goal.`);
  }
  if (plan.bufferMinor > 0) {
    out.push(
      `${formatMoney(plan.bufferMinor)} was held as a safety buffer because upcoming obligations still need cover.`,
    );
  }
  const modeBlurb = FUNDING_MODES.find((m) => m.id === mode)?.blurb;
  if (modeBlurb) out.push(`Mode: ${modeBlurb}`);
  return out.slice(0, 5);
}

export function nextBestMove(state: WaterfallState, today = todayIso()): string {
  const dependents = state.profile.dependents ?? "";
  const household = /children|mix|parents/i.test(dependents);
  const food = upcoming(state, today, 14).find((x) => /food|rent|housing/i.test(x.item.label) && x.remainingMinor > 0);
  if (food && (food.level === "critical" || food.level === "high" || household)) {
    return household && /food/i.test(food.item.label)
      ? `This money feeds more than you. Fund ${food.item.label} by ${formatMoney(food.remainingMinor)} first.`
      : `Fund ${food.item.label} by ${formatMoney(food.remainingMinor)} before anything else.`;
  }
  const fuliza = totalFuliza(state);
  const daily = totalFulizaDaily(state);
  const essentialsShort = committedNeeds(state, today, 7);
  if (fuliza > 0 && essentialsShort <= 0) {
    const safe = safeToSpend(state, today);
    const bite = fulizaSuggestedPayment(fuliza, safe.amountMinor + Math.min(fuliza, 50_000));
    return `Fuliza ${formatMoney(fuliza)} is costing about ${formatMoney(daily)} a day. After essentials, I'd put ${formatMoney(bite)} toward it now.`;
  }
  if (fuliza > 0 && essentialsShort > 0) {
    return `Food and rent still need ${formatMoney(essentialsShort)}. Fuliza can wait — it's expensive, but missing meals is worse.`;
  }
  const p = upcoming(state, today, 21).find((x) => x.level === "critical" || x.level === "high");
  if (p) return `Fund ${p.item.label} by ${formatMoney(p.remainingMinor)}.`;
  const bday = nextBirthdayIso(state.profile.birthdayIso, today);
  if (bday && daysBetween(today, bday) <= 21) {
    const goal = state.items.find((i) => i.active && /birthday/i.test(i.label));
    const left = goal ? remainingOf(goal) : 0;
    if (left > 0) return `Your birthday is ${formatIso(bday)}. There's still ${formatMoney(left)} unfunded for it.`;
    return `Your birthday is ${formatIso(bday)}.`;
  }
  const unassigned = Math.max(0, liquidOf(state) - committedNeeds(state, today, 14) - state.prefs.minReserveMinor);
  if (unassigned > 50_000) return `You have ${formatMoney(unassigned)} sitting unassigned. Send it to a goal or keep it as reserve.`;
  const goal = state.items
    .filter((i) => i.active && i.bucket === "GOAL" && remainingOf(i) > 0)
    .sort((a, b) => a.priority - b.priority)[0];
  if (goal) return `Add ${formatMoney(Math.min(remainingOf(goal), 350_000))} to ${goal.label} this month.`;
  return "Log the next income when it arrives. Waterfall will take it from there.";
}

export function healthBreakdown(state: WaterfallState, today = todayIso()) {
  const needs = state.items.filter((i) => i.active && i.bucket === "NEED");
  const goals = state.items.filter((i) => i.active && i.bucket === "GOAL");
  const bills = needs.length ? needs.filter((i) => remainingOf(i) <= 0).length / needs.length : 1;
  const emergency = goals.find((g) => /emergency/i.test(g.label));
  const reserve = emergency
    ? Math.min(1, emergency.currentMinor / Math.max(1, emergency.targetMinor))
    : Math.min(1, liquidOf(state) / Math.max(1, committedNeeds(state, today, 30) * 3));
  const onTrack =
    goals.length === 0
      ? 1
      : goals.reduce((s, g) => s + Math.min(1, g.currentMinor / Math.max(1, g.targetMinor)), 0) / goals.length;
  const pressureAvg =
    upcoming(state, today, 30).reduce((s, p) => s + (p.level === "critical" ? 1 : p.level === "high" ? 0.6 : 0.15), 0) /
    Math.max(1, upcoming(state, today, 30).length);
  const score = Math.round(
    (bills * 0.35 + reserve * 0.25 + onTrack * 0.25 + (1 - Math.min(1, pressureAvg)) * 0.15) * 100,
  );
  const hurting: string[] = [];
  if (bills < 0.85) hurting.push("Some bills are still unfunded this cycle.");
  if (reserve < 0.5) hurting.push("Emergency reserve is thin.");
  if (onTrack < 0.5) hurting.push("Goals are behind the pace you set.");
  if (pressureAvg > 0.5) hurting.push("Upcoming deadlines are stacking up.");
  return {
    score: Math.max(12, Math.min(99, score)),
    billsPct: Math.round(bills * 100),
    reservePct: Math.round(reserve * 100),
    goalsPct: Math.round(onTrack * 100),
    pressure: pressureAvg > 0.7 ? "High" : pressureAvg > 0.4 ? "Medium" : "Low",
    hurting,
  };
}

export function askWaterfall(state: WaterfallState, question: string): string {
  const q = question.trim().toLowerCase();
  const today = todayIso();
  const safe = safeToSpend(state, today);
  const money = q.match(/(\d[\d,\s]*)/);
  const amount = money ? Number(money[1].replace(/[,\s]/g, "")) * 100 : 0;

  if (/fuliza|safaricom debt|overdraft/.test(q)) {
    const owed = totalFuliza(state);
    const daily = totalFulizaDaily(state);
    if (!owed) return "No Fuliza is on the books. If you use it, add it on the M-PESA account — outstanding, limit, done.";
    const food = state.items.find((i) => i.active && /food|rent/i.test(i.label) && remainingOf(i) > 0);
    if (food) {
      return `You owe ${formatMoney(owed)} on Fuliza, about ${formatMoney(daily)} a day. I still wouldn't repay it before ${food.label} (${formatMoney(remainingOf(food))} short). Pay the life bills, then kill the charge.`;
    }
    if (/should i pay|pay fuliza/.test(q)) {
      const bite = Math.min(owed, Math.max(1_000_00, Math.round(safe.amountMinor * 0.4)));
      return `Yes — after essentials. I'd put about ${formatMoney(bite)} toward Fuliza from what's safe. Leaving it costs roughly ${formatMoney(daily)} every day.`;
    }
    return `Fuliza outstanding ${formatMoney(owed)}. Daily drag about ${formatMoney(daily)}. Limit and charges live on your M-PESA account, not as a guess.`;
  }

  if (/birthday/.test(q)) {
    const iso = state.profile.birthdayIso;
    if (!iso) return "You haven't told Waterfall your birthday. Add it in setup or You — I will not guess.";
    const next = nextBirthdayIso(iso, today);
    const days = next ? daysBetween(today, next) : null;
    return `Your birthday is ${formatIso(iso.slice(5) === today.slice(5) ? iso : next ?? iso)}${days != null ? ` — ${days} day${days === 1 ? "" : "s"} out` : ""}.`;
  }

  if (/how much.*(mpesa|m-pesa|equity|kcb|ncba|account|wallet)/.test(q) || /in (mpesa|m-pesa|equity)/.test(q)) {
    const rows = state.banks.filter((b) => b.active);
    if (!rows.length) return "No accounts yet.";
    return rows
      .map((b) => {
        const name = b.nickname || b.bankName;
        const line = `${name}: current ${formatMoney(b.balanceMinor)}, available ${formatMoney(availableOf(b))}, reserved ${formatMoney(b.reservedMinor ?? 0)}`;
        const f = fulizaOutstanding(b);
        return f > 0 ? `${line}. Fuliza −${formatMoney(f)}.` : `${line}.`;
      })
      .join(" ");
  }

  if (/why/.test(q) && state.lastPlan) {
    return decide(state, {
      incomeMinor: state.lastPlan.incomeMinor,
      sourceLabel: state.events[0]?.sourceLabel ?? "Income",
      bankId: state.lastPlan.bankLine?.itemId ?? null,
    }).explanations.join(" ");
  }
  if (/afford|can i spend|buy/.test(q)) {
    if (!amount) return `You currently have ${formatMoney(safe.amountMinor)} safe to spend${safe.untilIso ? ` through ${formatIso(safe.untilIso)}` : ""}.`;
    if (amount <= safe.amountMinor) {
      const left = safe.amountMinor - amount;
      return `Yes, with a caveat. After that purchase, safe-to-spend would be ${formatMoney(left)}. ${left < 200_000 ? "Keep the next week quiet." : "You still have room."}`;
    }
    const rent = state.items.find((i) => /rent/i.test(i.label) && remainingOf(i) > 0);
    if (rent) return `I'd avoid it. That would leave ${rent.label} underfunded by ${formatMoney(remainingOf(rent))}.`;
    return `I'd avoid it. You only have ${formatMoney(safe.amountMinor)} in discretionary capacity.`;
  }
  if (/this week|spend this week/.test(q)) {
    return `About ${formatMoney(safe.perDayMinor * 7)} this week, or ${formatMoney(safe.perDayMinor)} a day.`;
  }
  if (/emergency|when will/.test(q)) {
    const g = state.items.find((i) => /emergency/i.test(i.label));
    if (!g) return "You don't have an emergency fund envelope yet. Add one as a goal.";
    const left = remainingOf(g);
    if (left <= 0) return `${g.label} is complete.`;
    return `${g.label} still needs ${formatMoney(left)}. At a steady ${formatMoney(350_000)} a month, that's roughly ${Math.max(1, Math.ceil(left / 350_000))} months.`;
  }
  if (/debt/.test(q)) {
    const fuliza = totalFuliza(state);
    const other = state.debts.reduce((s, d) => s + d.remainingMinor, 0);
    if (!fuliza && !other) return "No debt on the books.";
    return `Debt: ${fuliza ? `Fuliza ${formatMoney(fuliza)}. ` : ""}${other ? `Other ${formatMoney(other)}.` : ""}`;
  }
  if (/priorit|next|should i/.test(q)) return nextBestMove(state, today);
  if (/next month|need for next/.test(q)) {
    const need = committedNeeds(state, today, 31);
    return `Next month's essentials still want ${formatMoney(need)}.`;
  }
  return `Safe to spend is ${formatMoney(safe.amountMinor)}${safe.untilIso ? ` through ${formatIso(safe.untilIso)}` : ""}. ${nextBestMove(state, today)}`;
}

function applyFulizaPressure(state: WaterfallState, plan: AllocationPlan): AllocationPlan {
  const owed = totalFuliza(state);
  if (owed <= 0) return plan;
  const daily = totalFulizaDaily(state);
  const foodShort = state.items
    .filter((i) => i.active && i.bucket === "NEED" && /food|rent|housing/i.test(i.label))
    .reduce((s, i) => s + remainingOf(i), 0);
  const lifestyle = plan.itemLines.filter((l) => l.bucket === "WANT" && l.amountMinor > 0);
  const pool = lifestyle.reduce((s, l) => s + l.amountMinor, 0);
  if (pool <= 0) {
    return {
      ...plan,
      notes: [
        ...plan.notes,
        foodShort > 0
          ? `Fuliza ${formatMoney(owed)} is accruing ~${formatMoney(daily)}/day, but food and rent still come first.`
          : `Fuliza ${formatMoney(owed)} is accruing ~${formatMoney(daily)}/day. No spare lifestyle to pull from this income.`,
      ],
    };
  }
  const take = Math.min(owed, Math.round(pool * 0.7));
  if (take <= 0) return plan;
  let left = take;
  const nextLines = plan.itemLines.map((l) => {
    if (l.bucket !== "WANT" || left <= 0) return l;
    const cut = Math.min(l.amountMinor, left);
    left -= cut;
    return { ...l, amountMinor: l.amountMinor - cut, note: "Trimmed so Fuliza can be cut down." };
  });
  const taken = take - left;
  return {
    ...plan,
    itemLines: [
      ...nextLines.filter((l) => l.amountMinor > 0 || l.kind === "BUFFER"),
      {
        itemId: null,
        label: "Fuliza payoff",
        bucket: "NEED",
        kind: "CURRENT",
        amountMinor: taken,
        remainingAfterMinor: owed - taken,
        dueDateIso: null,
        note: `Accruing ~${formatMoney(daily)}/day. Food and rent stayed funded first.`,
      },
    ],
    notes: [...plan.notes, `${formatMoney(taken)} toward Fuliza after essentials. Leaving it costs about ${formatMoney(daily)} a day.`],
  };
}

export function scenario(state: WaterfallState, monthlySaveMinor: number): string {
  const g = state.items.filter((i) => i.active && i.bucket === "GOAL" && remainingOf(i) > 0)[0];
  if (!g) return "No open goals to model against.";
  const months = Math.max(1, Math.ceil(remainingOf(g) / Math.max(1, monthlySaveMinor)));
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${g.label} completes around ${d.toLocaleString("en-KE", { month: "long", year: "numeric" })} if you put ${formatMoney(monthlySaveMinor)} toward it each month.`;
}

export function formatIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}

export function anomalies(state: WaterfallState): string[] {
  const flags: string[] = [];
  const today = todayIso();
  const month = monthKey(today);
  const salaries = state.incomeEntries.filter((e) => /salary/i.test(e.sourceLabel) && e.receivedIso.startsWith(month));
  if (salaries.length >= 2) flags.push("You logged two salary payments this month.");
  const rent = state.items.find((i) => /rent/i.test(i.label));
  if (rent && rent.targetMinor > 0) {
    const usual = 2_500_000;
    if (Math.abs(rent.targetMinor - usual) / usual > 0.25 && rent.targetMinor !== usual) {
      flags.push(`Rent is ${formatMoney(rent.targetMinor)} this cycle — check that's expected.`);
    }
  }
  return flags;
}

export function parseKenyanNaturalInput(input: string): { amountText: string; payee: string; category: string } {
  const text = input.trim();
  const numMatch = text.match(/(?:ksh|kes)?\s*([\d,]+(?:\.\d{1,2})?)(?:\/=)?/i);
  const amountText = numMatch ? numMatch[1].replace(/,/g, "") : "";

  let category = "General";
  let payee = text || "Expense";

  if (/matatu|fare|stage|uber|bolt|supermetro|transport/i.test(text)) {
    category = "Transport";
    payee = "Matatu / Transport";
  } else if (/food|groceries|naivas|carrefour|quickmart|supper|lunch|tea|chakula/i.test(text)) {
    category = "Food";
    payee = "Food & Groceries";
  } else if (/tokens|stima|kplc|water|utility|rent/i.test(text)) {
    category = "Utilities";
    payee = "Housing & Utilities";
  } else if (/airtime|bundles|safaricom|data/i.test(text)) {
    category = "Phone";
    payee = "Airtime & Bundles";
  }

  return { amountText, payee, category };
}

/** Used only to keep survival-floor math referenced for tests / future wiring. */
export function survivalHint(item: BudgetItem): number {
  return survivalFloor(item);
}
