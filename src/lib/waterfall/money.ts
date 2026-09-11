const ZERO_DECIMAL = new Set(["JPY", "RWF", "TZS", "BIF"]);

export function decimalsFor(code: string): number {
  return ZERO_DECIMAL.has(code.toUpperCase()) ? 0 : 2;
}

export function symbolFor(currencyCode: string): string {
  const c = currencyCode.toUpperCase();
  if (c === "KES") return "KSh";
  if (c === "USD") return "$";
  if (c === "GBP") return "£";
  if (c === "EUR") return "€";
  return c;
}

export function parseAmountMinor(value: string, currencyCode = "KES"): number {
  const cleaned = value.trim().replace(/[\s,]/g, "");
  if (!cleaned) return 0;
  const major = Number(cleaned);
  if (!Number.isFinite(major) || major < 0) return 0;
  const scale = 10 ** decimalsFor(currencyCode);
  return Math.round(major * scale);
}

export function majorOf(minor: number, currencyCode = "KES"): number {
  const scale = 10 ** decimalsFor(currencyCode);
  return minor / scale;
}

export function formatInt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("en-KE");
}

export function formatMoney(minor: number, currencyCode = "KES", opts?: { compact?: boolean }): string {
  const major = majorOf(minor, currencyCode);
  if (opts?.compact && Math.abs(major) >= 1000) {
    const abs = Math.abs(major);
    const formatted =
      abs >= 1_000_000
        ? `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
        : `${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
    return `${symbolFor(currencyCode)} ${major < 0 ? "−" : ""}${formatted}`;
  }
  const digits = decimalsFor(currencyCode);
  const body = Math.abs(major).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits === 0 ? 0 : 0,
  });
  return `${symbolFor(currencyCode)} ${major < 0 ? "−" : ""}${body}`;
}

export function formatMoneyParts(minor: number, currencyCode = "KES") {
  const major = majorOf(minor, currencyCode);
  return {
    currency: symbolFor(currencyCode),
    amount: Math.round(Math.abs(major)).toLocaleString("en-KE"),
    negative: major < 0,
  };
}

export function todayIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

export function addMonthsIso(months: number, from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return todayIso(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00");
  const b = new Date(toIso + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function remainingOf(item: { targetMinor: number; currentMinor: number }): number {
  return Math.max(0, item.targetMinor - item.currentMinor);
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
