import { estimateDebtPayoff, estimateGoalCompletion, financialHealth, computeSafeToSpend } from "./engine.ts";
import { formatMoney, monthKey, remainingOf, todayIso } from "./money.ts";
import type { BudgetItem, Debt, Investment, Transaction, WaterfallState, BankAccount } from "./types.ts";

export interface Insight {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "neutral";
}

export interface NaturalParsedTxn {
  kind: "expense" | "income" | "transfer";
  amountMinor: number;
  payee: string;
  category: string;
  accountName: string | null;
  accountId: number | null;
  confidence: number;
  rawText: string;
  note: string | null;
}

export interface AskResponse {
  answer: string;
  metricLabel?: string;
  metricValue?: string;
  breakdown?: { label: string; value: string }[];
  recommendation?: string;
  tone: "good" | "warn" | "neutral";
}

export interface AnomalyReport {
  id: string;
  category: string;
  currentMinor: number;
  baselineMinor: number;
  pctIncrease: number;
  severity: "mild" | "significant" | "critical";
  message: string;
}

export interface VelocityReport {
  daysPassed: number;
  daysRemaining: number;
  dailySpentMinor: number;
  projectedMonthTotalMinor: number;
  sustainableDailyMinor: number;
  status: "ON_TRACK" | "ACCELERATED" | "CRITICAL";
}

const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  naivas: "Food",
  carrefour: "Food",
  quickmart: "Food",
  chandarana: "Food",
  kobil: "Transport",
  rubis: "Transport",
  total: "Transport",
  shell: "Transport",
  bolt: "Transport",
  uber: "Transport",
  matatu: "Transport",
  supermetro: "Transport",
  safaricom: "Utilities",
  airtel: "Utilities",
  kplc: "Utilities",
  token: "Utilities",
  tokens: "Utilities",
  electricity: "Utilities",
  water: "Utilities",
  nairobiwater: "Utilities",
  zuku: "Utilities",
  jambo: "Utilities",
  faiba: "Utilities",
  dstv: "Utilities",
  gotv: "Utilities",
  netflix: "Lifestyle",
  spotify: "Lifestyle",
  hospital: "Health",
  pharmacy: "Health",
  chemist: "Health",
  clinic: "Health",
  rent: "Housing",
  house: "Housing",
  landlord: "Housing",
  school: "Education",
  fees: "Education",
  tuition: "Education",
  chama: "Savings",
  sacco: "Savings",
  family: "Family Support",
  mother: "Family Support",
  father: "Family Support",
  shosh: "Family Support",
  cuzo: "Family Support",
};

const SWAHILI_INCOME_WORDS = ["nimepata", "mshahara", "salary", "pata", "ingia", "received", "credited", "bonus", "advance"];
const SWAHILI_EXPENSE_WORDS = ["nimetumia", "lipa", "paid", "bought", "boughten", "spent", "tumia", "nunua", "paybill", "till"];

export function parseNaturalLanguageTxn(text: string, state: WaterfallState): NaturalParsedTxn {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  let kind: "income" | "expense" | "transfer" = "expense";
  if (SWAHILI_INCOME_WORDS.some((w) => lower.includes(w))) {
    kind = "income";
  } else if (lower.includes("transfer") || lower.includes("hamisha") || lower.includes("to mshwari") || lower.includes("to sacco")) {
    kind = "transfer";
  }

  let amountMinor = 0;
  const amountMatch = lower.match(/(?:ksh|sh|kes|\$)?\s*([\d,]+(?:\.\d+)?)(?:\s*([km])(?!\w|-))?/i);
  if (amountMatch) {
    let numStr = amountMatch[1].replace(/,/g, "");
    let num = parseFloat(numStr);
    const suffix = amountMatch[2]?.toLowerCase();
    if (suffix === "k") num *= 1000;
    if (suffix === "m") num *= 1000000;
    if (!isNaN(num) && num > 0) {
      amountMinor = Math.round(num * 100);
    }
  }

  let category = kind === "income" ? "Salary" : "General";
  let payee = "Transaction";

  for (const [key, cat] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (lower.includes(key)) {
      category = cat;
      payee = key.charAt(0).toUpperCase() + key.slice(1);
      break;
    }
  }

  if (payee === "Transaction") {
    const tokens = clean.split(/\s+/).filter((t) => !/^(nimetumia|nimepata|kwa|za|ksh|kes|sh|paid|spent|for|from|to|\d+k?)$/i.test(t));
    if (tokens.length > 0) {
      payee = tokens.slice(0, 3).join(" ");
      payee = payee.charAt(0).toUpperCase() + payee.slice(1);
    }
  }

  let accountId: number | null = null;
  let accountName: string | null = null;

  if (lower.includes("mpesa") || lower.includes("m-pesa") || lower.includes("till") || lower.includes("paybill")) {
    const mpesa = state.banks.find((b) => /m-pesa|mpesa/i.test(b.bankName) || /m-pesa|mpesa/i.test(b.accountName));
    if (mpesa) {
      accountId = mpesa.id;
      accountName = mpesa.bankName;
    }
  } else if (lower.includes("bank") || lower.includes("equity") || lower.includes("kcb") || lower.includes("coop")) {
    const bank = state.banks.find((b) => /bank|equity|kcb|coop/i.test(b.bankName));
    if (bank) {
      accountId = bank.id;
      accountName = bank.bankName;
    }
  }

  if (!accountId && state.banks.length > 0) {
    const defaultAcc = state.banks.find((b) => b.isDefault) ?? state.banks[0];
    accountId = defaultAcc.id;
    accountName = defaultAcc.bankName;
  }

  const confidence = amountMinor > 0 ? (category !== "General" ? 0.95 : 0.75) : 0.3;

  return {
    kind,
    amountMinor,
    payee,
    category,
    accountName,
    accountId,
    confidence,
    rawText: text,
    note: `Parsed from: "${text}"`,
  };
}

export function queryAskWaterfall(prompt: string, state: WaterfallState, now = new Date()): AskResponse {
  const lower = prompt.toLowerCase().trim();
  const currency = state.profile.baseCurrencyCode;
  const today = todayIso(now);
  const thisMonth = monthKey(today);

  if (lower.includes("can i afford") || lower.includes("afford") || lower.includes("siwezi") || lower.includes("naweza")) {
    const amountMatch = lower.match(/(?:ksh|sh|kes|\$)?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?/i);
    let targetMinor = 0;
    if (amountMatch) {
      let num = parseFloat(amountMatch[1].replace(/,/g, ""));
      if (amountMatch[2]?.toLowerCase() === "k") num *= 1000;
      targetMinor = Math.round(num * 100);
    }

    const safeToSpendMinor = computeSafeToSpend(state, now);

    if (targetMinor <= 0) {
      return {
        answer: "Please specify the amount you want to check (e.g., 'Can I afford KSh 15,000?').",
        tone: "neutral",
      };
    }

    if (targetMinor <= safeToSpendMinor) {
      const remainingAfter = safeToSpendMinor - targetMinor;
      return {
        answer: `Yes, you can safely afford ${formatMoney(targetMinor, currency)}. You currently have ${formatMoney(safeToSpendMinor, currency)} in uncommitted safe-to-spend money.`,
        metricLabel: "Safe-to-Spend After",
        metricValue: formatMoney(remainingAfter, currency),
        tone: "good",
        recommendation: "Your upcoming commitments and emergency buffer remain fully covered.",
      };
    } else {
      const shortfall = targetMinor - safeToSpendMinor;
      return {
        answer: `Buying this would exceed your safe-to-spend buffer by ${formatMoney(shortfall, currency)}. Doing so may compromise upcoming essential commitments.`,
        metricLabel: "Shortfall Risk",
        metricValue: formatMoney(shortfall, currency),
        tone: "warn",
        recommendation: "Consider reallocating from flexible envelopes or waiting until next income period.",
      };
    }
  }

  if (lower.includes("broke") || lower.includes("running low") || lower.includes("mbona") || lower.includes("why")) {
    const expenses = state.transactions.filter((t) => t.kind === "expense" && t.isoDate.startsWith(thisMonth));
    const totalSpent = expenses.reduce((s, t) => s + t.amountMinor, 0);

    const categories = spendByCategory(state.transactions, thisMonth);
    const topCat = categories[0];

    return {
      answer: `So far this month you have spent ${formatMoney(totalSpent, currency)}. Your heaviest category is ${topCat ? topCat.label : "General"} at ${topCat ? formatMoney(topCat.value, currency) : "0"}.`,
      metricLabel: "Largest Outflow Category",
      metricValue: topCat ? topCat.label : "None",
      tone: "warn",
      breakdown: categories.slice(0, 3).map((c) => ({ label: c.label, value: formatMoney(c.value, currency) })),
      recommendation: "Review post-payday spending acceleration in your primary envelopes.",
    };
  }

  if (lower.includes("transport") || lower.includes("food") || lower.includes("groceries") || lower.includes("rent")) {
    let cat = "Transport";
    if (lower.includes("food") || lower.includes("groceries")) cat = "Food";
    if (lower.includes("rent")) cat = "Housing";

    const spent = state.transactions
      .filter((t) => t.kind === "expense" && t.category === cat && t.isoDate.startsWith(thisMonth))
      .reduce((s, t) => s + t.amountMinor, 0);

    return {
      answer: `You have spent ${formatMoney(spent, currency)} on ${cat} in ${thisMonth}.`,
      metricLabel: `${cat} Spent`,
      metricValue: formatMoney(spent, currency),
      tone: "neutral",
    };
  }

  const safeToSpend = computeSafeToSpend(state, now);
  return {
    answer: `Here is your current financial summary: Safe-to-spend stands at ${formatMoney(safeToSpend, currency)} with active ledger monitoring across ${state.banks.length} account(s).`,
    metricLabel: "Current Safe-to-Spend",
    metricValue: formatMoney(safeToSpend, currency),
    tone: "good",
  };
}

export function dashboardInsights(state: WaterfallState, now = new Date()): Insight[] {
  const today = todayIso(now);
  const thisMonth = monthKey(today);
  const lastDate = new Date(now);
  lastDate.setMonth(lastDate.getMonth() - 1);
  const lastMonth = monthKey(todayIso(lastDate));
  const currency = state.profile.baseCurrencyCode;
  const insights: Insight[] = [];

  const spendFor = (month: string, category?: string) =>
    state.transactions
      .filter((t) => t.kind === "expense" && t.isoDate.startsWith(month) && (!category || t.category === category))
      .reduce((s, t) => s + t.amountMinor, 0);

  const foodNow = spendFor(thisMonth, "Food");
  const foodThen = spendFor(lastMonth, "Food");
  const foodDelta = pctDelta(foodNow, foodThen);
  if (foodDelta != null && (foodNow > 0 || foodThen > 0)) {
    insights.push({
      id: "food",
      eyebrow: "Food Velocity",
      title:
        foodDelta < 0
          ? `Food spending is down ${Math.abs(foodDelta)}% compared to last month.`
          : foodDelta === 0
            ? "Food spending is level with last month."
            : `Food spending is up ${foodDelta}% compared to last month.`,
      body: `${formatMoney(foodNow, currency)} recorded so far this period.`,
      tone: foodDelta <= 0 ? "good" : "warn",
    });
  }

  const fulizaBank = state.banks.find((b) => b.fulizaEnabled && (b.fulizaOutstandingMinor ?? 0) > 0);
  if (fulizaBank && fulizaBank.fulizaOutstandingMinor) {
    insights.push({
      id: "fuliza-alert",
      eyebrow: "Fuliza Overdraft",
      title: `Outstanding Fuliza balance of ${formatMoney(fulizaBank.fulizaOutstandingMinor, currency)}.`,
      body: "Incoming M-Pesa deposits will automatically settle this overdraft before envelope allocation.",
      tone: "warn",
    });
  }

  const emergency = state.items.find((i) => /emergency/i.test(i.label) && i.active);
  if (emergency) {
    const remaining = remainingOf(emergency);
    const monthlyContribution = Math.max(1, Math.round(emergency.currentMinor / 6));
    const months = remaining <= 0 ? 0 : Math.max(1, Math.ceil(remaining / monthlyContribution));
    insights.push({
      id: "emergency",
      eyebrow: "Savings Trajectory",
      title:
        remaining <= 0
          ? "Your emergency fund is fully funded."
          : `Emergency reserve projected target completion in ~${months} month${months === 1 ? "" : "s"}.`,
      body: `${formatMoney(emergency.currentMinor, currency)} funded of ${formatMoney(emergency.targetMinor, currency)} target.`,
      tone: "good",
    });
  }

  const debt = state.debts[0];
  if (debt && debt.remainingMinor > 0) {
    insights.push({
      id: "debt",
      eyebrow: "Debt Payoff",
      title: estimateDebtPayoff(debt, today),
      body: `${formatMoney(debt.remainingMinor, currency)} remaining on principal.`,
      tone: "neutral",
    });
  }

  return insights.slice(0, 4);
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function goalCopy(item: BudgetItem, now = new Date()) {
  const remaining = remainingOf(item);
  const pct = item.targetMinor > 0 ? Math.round((item.currentMinor / item.targetMinor) * 100) : 0;
  return {
    remaining,
    pct,
    estimate: estimateGoalCompletion(item, todayIso(now)),
  };
}

export function investmentCopy(inv: Investment, currency: string): string {
  const gain = inv.valueMinor - inv.costMinor;
  if (gain > 0) {
    const pct = inv.costMinor > 0 ? Math.round((gain / inv.costMinor) * 100) : 0;
    return `Up ${pct}% from cost. Roughly ${formatMoney(Math.round(inv.valueMinor * (inv.apr / 12)), currency)} monthly yield.`;
  }
  if (gain < 0) return `Down from cost basis of ${formatMoney(inv.costMinor, currency)}.`;
  return "Held at cost basis.";
}

export function emptyCopy(kind: "expenses" | "goals" | "investments" | "reports" | "accounts" | "budget" | "activity") {
  switch (kind) {
    case "expenses":
      return {
        title: "No expenses recorded",
        body: "Your wallet is quiet. Tap + to record a financial transaction.",
      };
    case "goals":
      return {
        title: "No active goals",
        body: "Set financial targets and Waterfall will model your savings trajectory.",
      };
    case "investments":
      return {
        title: "No investments tracked",
        body: "Track MMF, SACCO deposits, or equities to monitor real yield.",
      };
    case "reports":
      return {
        title: "No reporting data",
        body: "As you record transactions, intelligence reports will populate.",
      };
    case "accounts":
      return {
        title: "No accounts linked",
        body: "Add M-Pesa or bank accounts to track real balances.",
      };
    case "budget":
      return {
        title: "No envelopes configured",
        body: "Configure essential obligations to automate safe-to-spend calculations.",
      };
    case "activity":
      return {
        title: "Clean financial ledger",
        body: "Recorded transactions and Waterfall allocations will appear here.",
      };
  }
}

export function healthForState(state: WaterfallState, now = new Date()) {
  const today = todayIso(now);
  const thisMonth = monthKey(today);
  const monthlyIncome = state.incomeEntries
    .filter((e) => e.receivedIso.startsWith(thisMonth))
    .reduce((s, e) => s + e.amountMinor, 0);
  const monthlySpend = state.transactions
    .filter((t) => t.kind === "expense" && t.isoDate.startsWith(thisMonth))
    .reduce((s, t) => s + t.amountMinor, 0);
  const liquid = state.banks.filter((b) => b.active).reduce((s, b) => s + b.balanceMinor, 0);
  const emergency = state.items.find((i) => /emergency/i.test(i.label));
  const monthlyNeed = state.items
    .filter((i) => i.bucket === "NEED" && i.active)
    .reduce((s, i) => s + i.targetMinor, 0);
  return financialHealth({
    monthlyIncomeMinor: monthlyIncome,
    monthlySpendMinor: monthlySpend,
    liquidMinor: liquid,
    investments: state.investments,
    debts: state.debts,
    emergencyMinor: emergency?.currentMinor ?? 0,
    monthlyNeedMinor: monthlyNeed,
  });
}

export function monthFlow(entries: { receivedIso: string; amountMinor: number }[], months = 6, now = new Date()) {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    keys.push(monthKey(todayIso(d)));
  }
  return keys.map((key) => ({
    key,
    income: entries.filter((e) => e.receivedIso.startsWith(key)).reduce((s, e) => s + e.amountMinor, 0),
  }));
}

export function spendByCategory(transactions: Transaction[], month: string) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== "expense" || !t.isoDate.startsWith(month)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amountMinor);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
