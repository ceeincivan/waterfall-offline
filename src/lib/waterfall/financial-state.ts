import { daysBetween, remainingOf, todayIso } from "./money";
import { applyPeriod, expectedNextIncome, minViableOf } from "./tradeoff";
import type { BankAccount, BudgetBucket, BudgetItem, WaterfallState } from "./types";

export interface Obligation {
  item: BudgetItem;
  remainingMinor: number;
  minViableMinor: number;
  dueDateIso: string | null;
  days: number | null;
}

export interface CanonicalState {
  today: string;
  liquidMinor: number;
  reservedMinor: number;
  allocatedMinor: number;
  availableMinor: number;
  obligations: Obligation[];
  nextIncome: { iso: string | null; minor: number; irregular: boolean };
  cashFloorMinor: number;
  accounts: BankAccount[];
}

export interface Drain {
  itemId: number | null;
  label: string;
  bucket: BudgetBucket;
  takenMinor: number;
}

export interface Reallocation {
  amountMinor: number;
  drains: Drain[];
  uncoveredMinor: number;
  protectedLabels: string[];
  delayedGoals: string[];
  explanation: string;
}

export function spendableLiquid(state: WaterfallState): number {
  return state.banks
    .filter((b) => b.active && b.purpose !== "SAVINGS" && b.purpose !== "INVESTMENT")
    .reduce((s, b) => s + Math.max(0, b.balanceMinor), 0);
}

export function canonical(state: WaterfallState, today = todayIso()): CanonicalState {
  const items = applyPeriod(state.items, today);
  const liquid = spendableLiquid(state);
  const allocated = items.reduce((s, i) => s + i.currentMinor, 0);
  const floor = state.prefs.minReserveMinor;
  const next = expectedNextIncome(state.incomeEntries, today, state.profile.payDay, state.profile.incomeFrequency);
  const obligations: Obligation[] = items
    .filter((i) => i.active && remainingOf(i) > 0)
    .map((item) => ({
      item,
      remainingMinor: remainingOf(item),
      minViableMinor: minViableOf(item, today, next.iso ? Math.max(1, daysBetween(today, next.iso)) : 28),
      dueDateIso: item.dueDateIso,
      days: item.dueDateIso ? daysBetween(today, item.dueDateIso) : null,
    }));
  return {
    today,
    liquidMinor: liquid,
    reservedMinor: floor,
    allocatedMinor: allocated,
    availableMinor: Math.max(0, liquid - floor),
    obligations,
    nextIncome: next,
    cashFloorMinor: floor,
    accounts: state.banks.filter((b) => b.active),
  };
}

export function inferImportance(label: string): "ESSENTIAL" | "IMPORTANT" | "FLEXIBLE" | "GOAL" | null {
  const t = label.toLowerCase();
  if (/rent|housing|mortgage|food|grocer|medic|hospital|treatment|insulin|school fee|electric|water|transport|fare|fuel/.test(t)) {
    return "ESSENTIAL";
  }
  if (/insurance|debt|loan|nhif|nssf|internet|wifi|school/.test(t)) return "IMPORTANT";
  if (/phone|car|vacation|holiday|birthday|christmas|camera|laptop|invest/.test(t)) return "GOAL";
  if (/entertain|dining|shopping|netflix|game/.test(t)) return "FLEXIBLE";
  return null;
}

export function bucketForImportance(kind: "ESSENTIAL" | "IMPORTANT" | "FLEXIBLE" | "GOAL"): BudgetBucket {
  if (kind === "ESSENTIAL" || kind === "IMPORTANT") return "NEED";
  if (kind === "GOAL") return "GOAL";
  return "WANT";
}

export function reallocateEmergency(
  items: BudgetItem[],
  banks: BankAccount[],
  amountMinor: number,
  accountId: number | null,
): { items: BudgetItem[]; banks: BankAccount[]; result: Reallocation } {
  let remaining = amountMinor;
  const nextItems = items.map((i) => ({ ...i }));
  const drains: Drain[] = [];
  const take = (pred: (i: BudgetItem) => boolean) => {
    for (const item of nextItems) {
      if (remaining <= 0) break;
      if (!pred(item) || item.currentMinor <= 0) continue;
      const taken = Math.min(item.currentMinor, remaining);
      item.currentMinor -= taken;
      remaining -= taken;
      drains.push({ itemId: item.id, label: item.label, bucket: item.bucket, takenMinor: taken });
    }
  };

  take((i) => i.bucket === "WANT");
  take((i) => i.bucket === "GOAL" && !/emergency/i.test(i.label));

  const nextBanks = banks.map((b) => {
    if (remaining <= 0) return b;
    if (accountId && b.id !== accountId) return b;
    if (b.purpose === "SAVINGS") return b;
    const taken = Math.min(Math.max(0, b.balanceMinor), remaining);
    if (taken <= 0) return b;
    remaining -= taken;
    drains.push({
      itemId: null,
      label: b.nickname || b.bankName,
      bucket: "BANK",
      takenMinor: taken,
    });
    return { ...b, balanceMinor: b.balanceMinor - taken };
  });

  const protectedLabels = nextItems
    .filter((i) => i.bucket === "NEED" || /emergency/i.test(i.label))
    .map((i) => i.label);
  const delayedGoals = drains.filter((d) => d.bucket === "GOAL").map((d) => d.label);
  const lifestyle = drains.filter((d) => d.bucket === "WANT").reduce((s, d) => s + d.takenMinor, 0);
  const goals = drains.filter((d) => d.bucket === "GOAL").reduce((s, d) => s + d.takenMinor, 0);
  const reserve = drains.filter((d) => d.bucket === "BANK").reduce((s, d) => s + d.takenMinor, 0);

  const parts: string[] = [];
  if (lifestyle > 0) parts.push("lifestyle took the first hit");
  if (goals > 0) parts.push(delayedGoals.length ? `${delayedGoals[0]} was delayed` : "flexible goals were reduced");
  if (reserve > 0) parts.push("some unassigned cash was used");
  if (remaining > 0) parts.push("there wasn't enough flexible money to cover the rest");
  const explanation =
    remaining > 0
      ? `Rent, food, and the emergency fund stayed protected. ${parts.join(". ")}.`
      : `Your plan changed. ${parts.length ? parts.join(". ") : "Flexible money absorbed this"}. Essentials stayed protected.`;

  return {
    items: nextItems,
    banks: nextBanks,
    result: {
      amountMinor,
      drains,
      uncoveredMinor: remaining,
      protectedLabels,
      delayedGoals,
      explanation,
    },
  };
}
