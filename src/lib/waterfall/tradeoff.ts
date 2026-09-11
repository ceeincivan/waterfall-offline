import type { AllocationLine, AllocationPlan, BudgetItem } from "./types";
import { remainingOf, todayIso } from "./money";
import { daysBetween } from "./money";

export interface TradeoffContext {
  nextIncomeIso: string | null;
  nextIncomeMinor: number;
  irregular: boolean;
  cashFloorMinor: number;
  typicals: Record<string, number>;
  bankId: number | null;
  bankLabel: string;
}

function minViable(item: BudgetItem, today: string, daysToIncome: number): number {
  const remaining = remainingOf(item);
  if (remaining <= 0 || item.bucket !== "NEED") return 0;
  const days = item.dueDateIso ? daysBetween(today, item.dueDateIso) : null;
  const key = item.label.toLowerCase();
  let ratio = 0.5;
  if (/rent|housing|mortgage/.test(key)) ratio = days != null && days <= 10 ? 0.8 : 0.55;
  else if (/food|grocer/.test(key)) ratio = 0.7;
  else if (/transport|fare|fuel/.test(key)) ratio = 0.6;
  else if (/electric|water|utilit|internet/.test(key)) ratio = days != null && days <= 7 ? 1 : 0.55;
  else if (/medic|hospital|treatment/.test(key)) ratio = 1;
  else if (/school|fee/.test(key)) ratio = 0.8;
  else if (/insurance|debt/.test(key)) ratio = 0.7;
  return Math.min(remaining, Math.round(remaining * ratio));
}

export function minViableOf(item: BudgetItem, today: string, daysToIncome: number): number {
  return minViable(item, today, daysToIncome);
}

function pressure(item: BudgetItem, today: string): number {
  const days = item.dueDateIso ? daysBetween(today, item.dueDateIso) : null;
  const due = days == null ? 0.5 : days <= 0 ? 1 : days <= 3 ? 0.95 : days <= 8 ? 0.8 : days <= 15 ? 0.6 : 0.35;
  const consequence = /rent|medic/.test(item.label.toLowerCase()) ? 1.3 : item.bucket === "NEED" ? 1.1 : 0.7;
  return due * consequence;
}

export function tradeoffAllocate(
  incomeMinor: number,
  items: BudgetItem[],
  today: string,
  ctx: TradeoffContext,
): AllocationPlan {
  const daysToIncome = ctx.nextIncomeIso ? Math.max(1, daysBetween(today, ctx.nextIncomeIso)) : 28;
  const active = items.filter((i) => i.active && remainingOf(i) > 0);
  const grants = new Map<number, number>();
  const notes: string[] = [];
  const granted = (id: number) => grants.get(id) ?? 0;
  const left = (item: BudgetItem) => Math.max(0, remainingOf(item) - granted(item.id));
  const give = (item: BudgetItem, amount: number) => {
    const g = Math.max(0, Math.min(amount, left(item)));
    if (g <= 0) return 0;
    grants.set(item.id, granted(item.id) + g);
    return g;
  };

  const essentials = active.filter((i) => i.bucket === "NEED");
  const goals = active.filter((i) => i.bucket === "GOAL");
  const lifestyle = active.filter((i) => i.bucket === "WANT");
  const floors = new Map(essentials.map((i) => [i.id, minViable(i, today, daysToIncome)] as const));
  const survivalNeed = [...floors.values()].reduce((s, n) => s + n, 0);
  const livingDaily = Math.floor(
    essentials.filter((i) => /food|transport|fare/.test(i.label.toLowerCase())).reduce((s, i) => s + i.targetMinor, 0) / 30,
  );

  let buffer = ctx.irregular
    ? Math.max(ctx.cashFloorMinor, livingDaily * 3 + ctx.cashFloorMinor)
    : ctx.cashFloorMinor + livingDaily;
  buffer = Math.min(buffer, Math.floor(incomeMinor * 0.12));
  if (incomeMinor - buffer < survivalNeed) {
    buffer = Math.max(0, incomeMinor - survivalNeed);
    notes.push("I held back less reserve than usual so your essentials still have a floor until the next income.");
  }
  let pool = Math.max(0, incomeMinor - buffer);

  const floorNeed = survivalNeed;
  if (floorNeed > 0) {
    if (pool >= floorNeed) {
      for (const item of essentials) give(item, floors.get(item.id) ?? 0);
      pool -= floorNeed;
    } else {
      let used = 0;
      essentials.forEach((item, index) => {
        const floor = floors.get(item.id) ?? 0;
        const share = index === essentials.length - 1 ? pool - used : Math.floor((pool * floor) / Math.max(1, floorNeed));
        used += give(item, share);
      });
      pool = 0;
      notes.push(
        "This income cannot fully cover every essential minimum before your next expected money, so I shared it across the floors instead of giving the top bill everything.",
      );
    }
  }

  if (pool > 0) {
    const open = essentials.filter((i) => left(i) > 0).sort((a, b) => pressure(b, today) - pressure(a, today));
    for (const item of open) {
      if (pool <= 0) break;
      const cap = left(item);
      const others = open.filter((i) => i.id !== item.id).reduce((s, i) => s + Math.min(left(i), Math.floor((floors.get(i.id) ?? 0) / 4)), 0);
      const allow = pool - cap < others ? Math.max(Math.floor(pool / 3), pool - others) : cap;
      const g = give(item, Math.min(allow, pool));
      pool -= g;
    }
  }

  if (pool > 0) {
    const close = goals.filter((g) => g.targetMinor > 0 && g.currentMinor / g.targetMinor >= 0.8).sort((a, b) => remainingOf(a) - remainingOf(b));
    for (const item of close) {
      if (pool <= 0) break;
      const g = give(item, Math.min(left(item), pool));
      pool -= g;
      if (g > 0) notes.push(`${item.label} was close enough to finish, so I completed it rather than stretching it.`);
    }
    const rest = goals.filter((g) => left(g) > 0);
    if (rest.length && pool > 0) {
      const weights = rest.map((i) => ({ item: i, w: 1 + 3 / (i.priority + 1) }));
      const sum = weights.reduce((s, x) => s + x.w, 0);
      let used = 0;
      weights.forEach((row, i) => {
        const share = i === weights.length - 1 ? pool - used : Math.floor((pool * row.w) / sum);
        used += give(row.item, share);
      });
      pool -= used;
    }
  }

  if (pool > 0) {
    for (const item of [...lifestyle].sort((a, b) => a.priority - b.priority)) {
      if (pool <= 0) break;
      const typical = ctx.typicals[item.label.trim().toLowerCase()];
      const cap = typical != null ? Math.min(typical, left(item)) : left(item);
      const g = give(item, Math.min(cap, Math.floor(pool / 2)));
      pool -= g;
    }
  }

  const lines: AllocationLine[] = [];
  if (buffer > 0) {
    lines.push({
      itemId: null,
      label: "Reserve",
      bucket: "BANK",
      kind: "BUFFER",
      amountMinor: buffer,
      remainingAfterMinor: 0,
      dueDateIso: null,
      note: ctx.irregular ? "Held because this income is irregular." : "Safety until the next expected income.",
    });
  }

  for (const item of active) {
    const g = granted(item.id);
    if (g <= 0) continue;
    const after = remainingOf(item) - g;
    const floor = floors.get(item.id) ?? 0;
    let note = "After essentials were safe";
    if (after <= 0 && item.bucket === "NEED") note = "Fully funded this cycle";
    else if (g < floor) note = "Shared floor — fully funding this would starve other essentials";
    else if (item.bucket === "NEED" && after > 0) note = "Partial — other living costs still need a floor before the next income";
    else if (item.bucket === "GOAL") note = `Progress toward ${item.label}`;
    lines.push({
      itemId: item.id,
      label: item.label,
      bucket: item.bucket,
      kind: "CURRENT",
      amountMinor: g,
      remainingAfterMinor: Math.max(0, after),
      dueDateIso: item.dueDateIso,
      note,
    });
  }

  const rent = essentials.find((i) => /rent|housing/.test(i.label.toLowerCase()));
  if (rent) {
    const got = granted(rent.id);
    if (got > 0 && got < remainingOf(rent)) {
      notes.unshift(
        `I didn't fully fund ${rent.label} because doing so would leave food and transport below a workable floor before your next expected income.`,
      );
    }
  }
  if (ctx.nextIncomeIso && !ctx.irregular) {
    notes.push(`Next expected income around ${ctx.nextIncomeIso}.`);
  } else if (ctx.irregular) {
    notes.push("This source is irregular, so I kept more unassigned than I would for a salary.");
  }

  let bankLine: AllocationLine | null = null;
  if (pool > 0 && ctx.bankId != null) {
    bankLine = {
      itemId: ctx.bankId,
      label: ctx.bankLabel || "Selected account",
      bucket: "BANK",
      kind: "BANK",
      amountMinor: pool,
      remainingAfterMinor: 0,
      dueDateIso: null,
      note: "Unassigned remainder held at the destination.",
    };
    pool = 0;
  } else if (pool > 0) {
    lines.push({
      itemId: null,
      label: "Reserve",
      bucket: "BANK",
      kind: "BUFFER",
      amountMinor: pool,
      remainingAfterMinor: 0,
      dueDateIso: null,
      note: "Unassigned remainder.",
    });
    buffer += pool;
    pool = 0;
  }

  return {
    incomeMinor,
    currencyCode: "KES",
    bufferMinor: buffer,
    itemLines: lines.filter((l) => l.kind !== "BUFFER" || l.label === "Reserve"),
    bankLine,
    notes: [...new Set(notes)],
  };
}

export function expectedNextIncome(
  entries: { sourceLabel: string; amountMinor: number; receivedIso: string }[],
  today = todayIso(),
  payDay?: string | null,
  incomeFrequency?: "Monthly" | "Twice a month" | "Weekly" | "Irregular" | null,
) {
  const salary = entries.filter((e) => /salary|wage|pay|analytics/.test(e.sourceLabel.toLowerCase()));
  const sample = salary.length ? salary : entries;
  const avg = sample.length
    ? Math.round(sample.slice(0, 6).reduce((s, e) => s + e.amountMinor, 0) / Math.min(6, sample.length))
    : 0;
  const last = sample.length ? [...sample].sort((a, b) => b.receivedIso.localeCompare(a.receivedIso))[0] : null;
  const irregular =
    !sample.length ||
    sample.length < 2 ||
    payDay === "varies" ||
    incomeFrequency === "Irregular" ||
    (last != null && /freelance|gift|bonus|side/.test(last.sourceLabel.toLowerCase()));

  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  if (payDay && payDay !== "varies") {
    const day = payDay === "end" ? 28 : Math.max(1, Math.min(28, Number(payDay) || 1));
    const [y, m] = today.split("-").map(Number);
    let next = new Date(y, m - 1, day);
    if (toIso(next) <= today) next = new Date(y, m, day);
    if (incomeFrequency === "Weekly" && last) {
      const candidate = new Date(last.receivedIso + "T00:00:00");
      candidate.setDate(candidate.getDate() + 7);
      return { iso: toIso(candidate) < today ? today : toIso(candidate), minor: avg || last.amountMinor, irregular: false };
    }
    if (incomeFrequency === "Twice a month" && last) {
      const candidate = new Date(last.receivedIso + "T00:00:00");
      candidate.setDate(candidate.getDate() + 15);
      return { iso: toIso(candidate) < today ? today : toIso(candidate), minor: avg || last.amountMinor, irregular: false };
    }
    return { iso: toIso(next), minor: avg || last?.amountMinor || 0, irregular: false };
  }

  if (!last) return { iso: null as string | null, minor: 0, irregular: true };
  const lastDate = new Date(last.receivedIso + "T00:00:00");
  const next = new Date(lastDate);
  next.setMonth(next.getMonth() + 1);
  const nextIso = next.toISOString().slice(0, 10);
  return { iso: nextIso < today ? today : nextIso, minor: avg, irregular };
}

export function applyPeriod(items: BudgetItem[], today: string): BudgetItem[] {
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  return items.map((item) => {
    if (item.bucket === "GOAL" && (item.frequencyMonths ?? 0) >= 12) {
      if (item.targetMinor > 0 && item.currentMinor >= item.targetMinor && item.dueDateIso && item.dueDateIso <= today) {
        const next = new Date(item.dueDateIso + "T00:00:00");
        next.setFullYear(next.getFullYear() + 1);
        return {
          ...item,
          currentMinor: 0,
          dueDateIso: next.toISOString().slice(0, 10),
          periodKey: year,
        };
      }
      return item.periodKey ? item : { ...item, periodKey: year };
    }
    if (!item.recurring || item.bucket === "GOAL") {
      return item.periodKey ? item : { ...item, periodKey: month };
    }
    if (!item.periodKey) return { ...item, periodKey: month };
    if (item.periodKey === month) return item;
    return { ...item, currentMinor: 0, periodKey: month };
  });
}
