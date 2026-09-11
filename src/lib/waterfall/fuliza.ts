import { formatMoney } from "./money.ts";
import type { BankAccount, WaterfallState } from "./types.ts";

/**
 * Fuliza's charge is tiered; it is not "KSh 30 every day" for every balance.
 * Safaricom's terms describe a daily administrative fee capped at KSh 30/day,
 * with the applicable tariff communicated separately. The app therefore uses
 * the current tariff matrix as a model and prefers an account-specific fee
 * when the user has supplied one.
 */
export const FULIZA_ACCESS_FEE_RATE = 0.01;
export const FULIZA_MAX_DAILY_FEE_MINOR = 3_000;

export function isMpesa(bank: BankAccount): boolean {
  return bank.purpose === "MPESA" || /m-?pesa/i.test(bank.bankName) || /m-?pesa/i.test(bank.accountName) || bank.accountType === "MOBILE";
}

export function availableOf(bank: BankAccount): number {
  if (typeof bank.availableMinor === "number") return Math.max(0, bank.availableMinor);
  return Math.max(0, (bank.balanceMinor ?? 0) - (bank.reservedMinor ?? 0));
}

export function currentOf(bank: BankAccount): number {
  return Math.max(0, bank.balanceMinor ?? 0);
}

export function reservedOf(bank: BankAccount): number {
  return Math.max(0, bank.reservedMinor ?? 0);
}

export function fulizaOutstanding(bank: BankAccount): number {
  if (!bank.fulizaEnabled) return 0;
  return Math.max(0, bank.fulizaOutstandingMinor ?? 0);
}

/** Modelled daily maintenance fee in minor currency units. */
export function calculateFulizaDailyCostMinor(outstandingMinor: number): number {
  if (outstandingMinor <= 0) return 0;
  const kes = outstandingMinor / 100;
  if (kes <= 100) return 0;
  if (kes <= 500) return 500;
  if (kes <= 1_000) return 1_000;
  if (kes <= 1_500) return 2_000;
  if (kes <= 2_500) return 2_500;
  return FULIZA_MAX_DAILY_FEE_MINOR;
}

export function fulizaDailyCost(bank: BankAccount): number {
  const supplied = bank.fulizaDailyFeeMinor;
  if (typeof supplied === "number" && supplied >= 0) return Math.min(supplied, FULIZA_MAX_DAILY_FEE_MINOR);
  return calculateFulizaDailyCostMinor(fulizaOutstanding(bank));
}

export function fulizaAccessFeeMinor(outstandingMinor: number): number {
  return outstandingMinor > 0 ? Math.round(outstandingMinor * FULIZA_ACCESS_FEE_RATE) : 0;
}

export function fulizaDaysToPayoff(outstandingMinor: number, paymentMinor: number): number | null {
  if (outstandingMinor <= 0) return 0;
  if (paymentMinor <= 0) return null;
  return Math.max(1, Math.ceil(outstandingMinor / paymentMinor));
}

export function fulizaSuggestedPayment(outstandingMinor: number, safeToSpendMinor: number): number {
  if (outstandingMinor <= 0 || safeToSpendMinor <= 0) return 0;
  // Small balances are deliberately cleared first. A KSh 200 debt should not
  // compete with a generic "30/day" rule or be stretched into a fake schedule.
  if (outstandingMinor <= 50_000) return Math.min(outstandingMinor, safeToSpendMinor);
  return Math.min(outstandingMinor, Math.max(50_000, Math.round(safeToSpendMinor * 0.35)));
}

export interface FulizaPlan {
  outstandingMinor: number;
  dailyCostMinor: number;
  accessFeeMinor: number;
  projected30DayCostMinor: number;
  daysIfPaidRecommended: number | null;
  recommendedPaymentMinor: number;
  recommendation: string;
}

export function fulizaPlan(bank: BankAccount, availableAfterEssentialsMinor = 0): FulizaPlan | null {
  const outstandingMinor = fulizaOutstanding(bank);
  if (outstandingMinor <= 0) return null;
  const dailyCostMinor = fulizaDailyCost(bank);
  const recommendedPaymentMinor = fulizaSuggestedPayment(outstandingMinor, Math.max(0, availableAfterEssentialsMinor));
  const daysIfPaidRecommended = fulizaDaysToPayoff(outstandingMinor, recommendedPaymentMinor);
  const accessFeeMinor = fulizaAccessFeeMinor(outstandingMinor);
  const projected30DayCostMinor = dailyCostMinor * 30;
  const recommendation =
    recommendedPaymentMinor >= outstandingMinor
      ? `Clear the ${formatMoney(outstandingMinor)} balance after essentials. Your modelled maintenance charge is ${formatMoney(dailyCostMinor)}/day, not a flat KSh 30/day.`
      : recommendedPaymentMinor > 0
        ? `Put ${formatMoney(recommendedPaymentMinor)} toward Fuliza after essentials. At ${formatMoney(dailyCostMinor)}/day, every day left outstanding costs money.`
        : `Protect essentials first. Once spare cash appears, attack the ${formatMoney(outstandingMinor)} balance.`;
  return { outstandingMinor, dailyCostMinor, accessFeeMinor, projected30DayCostMinor, daysIfPaidRecommended, recommendedPaymentMinor, recommendation };
}

export function fulizaBanks(state: WaterfallState): BankAccount[] {
  return state.banks.filter((b) => b.active && fulizaOutstanding(b) > 0);
}

export function totalFuliza(state: WaterfallState): number {
  return fulizaBanks(state).reduce((s, b) => s + fulizaOutstanding(b), 0);
}

export function totalFulizaDaily(state: WaterfallState): number {
  return fulizaBanks(state).reduce((s, b) => s + fulizaDailyCost(b), 0);
}

export function effectiveMpesaPosition(bank: BankAccount): number {
  return availableOf(bank) - fulizaOutstanding(bank);
}

export function fulizaNote(bank: BankAccount): string | null {
  const owed = fulizaOutstanding(bank);
  if (owed <= 0) return null;
  const daily = fulizaDailyCost(bank);
  return `Fuliza ${formatMoney(owed)} · modelled maintenance ${formatMoney(daily)}/day.`;
}

export function nextBirthdayIso(birthdayIso: string | null, todayIso: string): string | null {
  if (!birthdayIso || birthdayIso.length < 10) return null;
  const mmdd = birthdayIso.slice(5, 10);
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return null;
  const thisYear = `${todayIso.slice(0, 4)}-${mmdd}`;
  if (thisYear >= todayIso) return thisYear;
  return `${Number(todayIso.slice(0, 4)) + 1}-${mmdd}`;
}
