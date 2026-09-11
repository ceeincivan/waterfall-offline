import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatInt, formatMoney, symbolFor } from "@/lib/waterfall/money";

export function GlassCard({
  children,
  className,
  onClick,
  padded = true,
  elevation = "02",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padded?: boolean;
  elevation?: "01" | "02" | "03" | "04";
}) {
  const Comp = onClick ? "button" : "div";
  const glassClass =
    elevation === "01"
      ? "glass-01"
      : elevation === "03"
        ? "glass-03"
        : elevation === "04"
          ? "glass-04"
          : "glass";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        glassClass,
        "w-full rounded-[28px] text-left transition-all duration-200",
        padded && "p-4.5",
        onClick && "press active:scale-[0.98]",
        className
      )}
    >
      <div className="glass-edge-shimmer" aria-hidden />
      {children}
    </Comp>
  );
}

export function Pill({
  children,
  selected,
  onClick,
  className,
  urgent,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  urgent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-all duration-150 active:scale-95",
        selected
          ? "border-accent bg-accent-soft text-accent shadow-sm"
          : "border-border bg-bg-subtle/60 text-fg hover:bg-bg-subtle",
        urgent && "border-danger/50 bg-danger/10 text-danger",
        className
      )}
    >
      {children}
    </button>
  );
}

export const SecondaryButton = GhostButton;

export function WaterfallNumberHero({
  minor,
  label = "SAFE TO SPEND",
  subtext,
  currency = "KES",
  animate = true,
}: {
  minor: number;
  label?: string;
  subtext?: string;
  currency?: string;
  animate?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-3 text-center">
      {label ? (
        <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
          {label}
        </span>
      ) : null}
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-fg-muted">{symbolFor(currency)}</span>
        <Money
          minor={minor}
          currency={currency}
          animate={animate}
          className="text-4xl sm:text-5xl font-black tracking-tight"
        />
      </div>
      {subtext ? <p className="mt-1.5 max-w-xs text-center text-[13px] leading-5 text-fg-muted">{subtext}</p> : null}
    </div>
  );
}

export function AnimatedNumber({
  value,
  className,
  duration = 800,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={cn("num", className)}>{formatInt(n)}</span>;
}

export function Money({
  minor,
  currency = "KES",
  className,
  animate,
  tone,
  showDecimals = false,
}: {
  minor: number;
  currency?: string;
  className?: string;
  animate?: boolean;
  tone?: "good" | "warn" | "danger" | "neutral";
  showDecimals?: boolean;
}) {
  const color =
    tone === "good"
      ? "text-good"
      : tone === "warn"
        ? "text-warn"
        : tone === "danger"
          ? "text-danger"
          : "";

  if (animate) {
    return (
      <span className={cn("num", color, className)}>
        {symbolFor(currency)} <AnimatedNumber value={Math.round(Math.abs(minor) / 100)} />
      </span>
    );
  }

  const abs = Math.abs(minor);
  if (!showDecimals) {
    return (
      <span className={cn("num", color, className)}>
        {formatMoney(abs, currency)}
      </span>
    );
  }

  const major = (abs / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span className={cn("num", color, className)}>
      {symbolFor(currency)} {major}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
  tone,
}: {
  value: number;
  className?: string;
  tone?: "good" | "warn" | "danger";
}) {
  const pct = Math.max(0, Math.min(1, value));
  const fill =
    tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : tone === "danger" ? "bg-danger" : "bg-accent";
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-bg-subtle/80", className)}>
      <div
        className={cn("progress-fill h-full rounded-full transition-all duration-300", fill)}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-fg-muted uppercase tracking-wider">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-[16px] border border-border bg-bg-subtle/80 px-4 text-[15px] font-medium text-fg outline-none transition-all duration-150 placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  className,
  loading,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-fg shadow-lg disabled:opacity-40 active:scale-95 transition-all duration-150",
        className
      )}
    >
      {loading ? <span className="spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "press inline-flex h-12 items-center justify-center rounded-[16px] border border-border bg-bg-elevated px-5 text-[15px] font-semibold text-fg active:scale-95 transition-all duration-150",
        className
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <GlassCard className="text-center py-6">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-1.5 text-sm leading-6 text-fg-muted max-w-sm mx-auto">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </GlassCard>
  );
}

export function LargeKeypad({
  value,
  onChange,
  onConfirm,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm?: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

  function handleKey(k: string) {
    if (k === "⌫") {
      onChange(value.slice(0, -1));
    } else if (k === ".") {
      if (!value.includes(".")) onChange(value + ".");
    } else {
      if (value.length < 9) onChange(value + k);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => handleKey(k)}
            className="press flex h-14 items-center justify-center rounded-2xl bg-bg-subtle/80 text-[22px] font-bold text-fg active:bg-accent/20 transition-all border border-border/40 shadow-sm"
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <h2 className="font-display text-[17px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] leading-5 text-fg-muted", className)}>{children}</p>;
}

export function Group({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {title ? (
        <div className="mb-2 flex items-end justify-between px-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-subtle">{title}</p>
          {action}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[20px] bg-bg-elevated/90 border border-border shadow-sm">{children}</div>
    </section>
  );
}

export function GroupRow({
  label,
  value,
  hint,
  last,
  accent,
  tone,
  onClick,
}: {
  label: string;
  value?: string;
  hint?: string;
  last?: boolean;
  accent?: boolean;
  tone?: "danger" | "warn" | "good";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-all",
        !last && "border-b border-border/60",
        onClick && "press hover:bg-bg-subtle/40 active:bg-bg-subtle/70",
      )}
    >
      <div className="min-w-0">
        <p className={cn("truncate text-[15px] font-semibold tracking-[-0.01em]", tone === "danger" && "text-danger", tone === "warn" && "text-warn", tone === "good" && "text-good")}>
          {label}
        </p>
        {hint ? <p className="mt-0.5 text-[13px] font-normal leading-4 text-fg-muted">{hint}</p> : null}
      </div>
      {value ? (
        <p
          className={cn(
            "num shrink-0 text-[15px] font-bold",
            accent && "text-accent",
            tone === "danger" && "text-danger",
            tone === "warn" && "text-warn",
            tone === "good" && "text-good",
          )}
        >
          {value}
        </p>
      ) : null}
    </Comp>
  );
}

export function StatusBar({ dark }: { dark: boolean }) {
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className={cn(
        "status-bar-fake flex h-11 shrink-0 items-end justify-between px-7 pb-1 text-[12px] font-semibold tracking-tight",
        dark ? "text-fg" : "text-fg",
      )}
    >
      <span className="num">{clock}</span>
      <span className="flex items-center gap-1.5 text-fg">
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </span>
    </div>
  );
}

function formatClock(d: Date) {
  return d.toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
}

function SignalIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor" aria-hidden>
      <rect x="0" y="7" width="2" height="3" rx="0.5" />
      <rect x="4" y="5" width="2" height="5" rx="0.5" />
      <rect x="8" y="2.5" width="2" height="7.5" rx="0.5" />
      <rect x="12" y="0" width="2" height="10" rx="0.5" opacity="0.35" />
    </svg>
  );
}
function WifiIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M1 3.2c3.4-3 8.6-3 12 0" />
      <path d="M3.2 5.4c2.2-2 5.4-2 7.6 0" />
      <circle cx="7" cy="8.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function BatteryIcon() {
  return (
    <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" />
      <rect x="2" y="2" width="13" height="7" rx="1.2" fill="currentColor" />
      <rect x="19.2" y="3.2" width="2" height="4.6" rx="0.6" fill="currentColor" />
    </svg>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50">
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-border-strong/60" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 border-b border-border/40">
          <h2 id="sheet-title" className="font-display text-xl font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="press text-sm font-semibold text-fg-muted hover:text-fg">
            Close
          </button>
        </div>
        <div className="scroll-y px-5 py-4 pb-8">{children}</div>
      </div>
    </div>
  );
}
