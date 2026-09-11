export type FrequencyCode =
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTH"
  | "QUARTER"
  | "SEMI"
  | "YEARLY"
  | "CUSTOM"
  | "ONCE";

export type CustomUnit = "days" | "weeks" | "months";

export const FREQUENCY_OPTIONS: { code: FrequencyCode; label: string; months: number }[] = [
  { code: "DAILY", label: "Daily", months: 1 },
  { code: "WEEKLY", label: "Weekly", months: 1 },
  { code: "BIWEEKLY", label: "Every 2 weeks", months: 1 },
  { code: "MONTHLY", label: "Monthly", months: 1 },
  { code: "BIMONTH", label: "Every 2 months", months: 2 },
  { code: "QUARTER", label: "Quarterly", months: 3 },
  { code: "SEMI", label: "Every 6 months", months: 6 },
  { code: "YEARLY", label: "Yearly", months: 12 },
  { code: "CUSTOM", label: "Custom", months: 1 },
  { code: "ONCE", label: "Once", months: 0 },
];

export function monthsForFrequency(code: FrequencyCode, customEvery = 1, customUnit: CustomUnit = "months"): number {
  if (code === "ONCE") return 0;
  if (code === "CUSTOM") {
    if (customUnit === "months") return Math.max(1, customEvery);
    return 1;
  }
  return FREQUENCY_OPTIONS.find((o) => o.code === code)?.months ?? 1;
}

export function inferFrequencyCode(recurring: boolean, months: number, stored?: string | null): FrequencyCode {
  if (stored && FREQUENCY_OPTIONS.some((o) => o.code === stored)) return stored as FrequencyCode;
  if (!recurring || months <= 0) return "ONCE";
  if (months >= 12) return "YEARLY";
  if (months === 6) return "SEMI";
  if (months === 3) return "QUARTER";
  if (months === 2) return "BIMONTH";
  return "MONTHLY";
}

export function frequencyLabel(
  recurring: boolean,
  months: number,
  stored?: string | null,
  customEvery?: number,
  customUnit?: CustomUnit,
): string {
  const code = inferFrequencyCode(recurring, months, stored);
  if (code === "CUSTOM") {
    const n = customEvery ?? 1;
    const unit = customUnit ?? "days";
    return `Every ${n} ${unit}`;
  }
  return FREQUENCY_OPTIONS.find((o) => o.code === code)?.label ?? "Monthly";
}
