import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/waterfall/money";

const PALETTE = ["#0b72b5", "#3f8f6b", "#c2782c", "#5b6573", "#78d7ff", "#8b939e"];

export function MiniLineChart({ points, className }: { points: number[]; className?: string }) {
  const id = useId();
  const values = points.length ? points : [0];
  const max = Math.max(...values, 1);
  const w = 320;
  const h = 120;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const coords = values.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h * 0.78) - h * 0.1;
    return [x, y] as const;
  });
  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c[0]} ${c[1]}`).join(" ");
  const area = `${d} L ${coords[coords.length - 1][0]} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-[120px] w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="3.2" strokeLinecap="round" className="chart-line" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="var(--color-bg-elevated)" stroke="var(--color-accent)" strokeWidth="2" />
      ))}
    </svg>
  );
}

export function DonutChart({
  segments,
  center,
  sub,
}: {
  segments: { label: string; value: number }[];
  center?: string;
  sub?: string;
}) {
  const size = 168;
  const r = 58;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-bg-subtle)" strokeWidth="14" />
          {segments.map((seg, i) => {
            const len = (seg.value / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth="14"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                className="chart-line"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {center ? <p className="font-display text-xl font-semibold">{center}</p> : null}
          {sub ? <p className="text-[11px] text-fg-muted">{sub}</p> : null}
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {segments.map((seg, i) => (
          <li key={seg.label} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-2 text-fg-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              {seg.label}
            </span>
            <span className="num text-fg">{formatInt(Math.round(seg.value / 100))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InteractiveWaterfallFlow({
  incomeMinor,
  needsMinor,
  wantsMinor,
  goalsMinor,
  debtMinor,
  onStreamTap,
}: {
  incomeMinor: number;
  needsMinor: number;
  wantsMinor: number;
  goalsMinor: number;
  debtMinor: number;
  onStreamTap?: (stream: "income" | "needs" | "wants" | "goals" | "debt", details: { amountMinor: number; pct: number }) => void;
}) {
  const totalOut = (needsMinor + wantsMinor + goalsMinor + debtMinor) || 1;
  const incomeFormatted = Math.round(incomeMinor / 100).toLocaleString("en-KE");
  const needsPct = Math.round((needsMinor / totalOut) * 100);
  const wantsPct = Math.round((wantsMinor / totalOut) * 100);
  const goalsPct = Math.round((goalsMinor / totalOut) * 100);
  const debtPct = Math.round((debtMinor / totalOut) * 100);

  const [activeStream, setActiveStream] = useState<"income" | "needs" | "wants" | "goals" | "debt" | null>(null);

  function handleTap(kind: "income" | "needs" | "wants" | "goals" | "debt", amt: number, pct: number) {
    setActiveStream(kind === activeStream ? null : kind);
    if (onStreamTap) onStreamTap(kind, { amountMinor: amt, pct });
  }

  return (
    <div className="relative rounded-3xl border border-white/15 bg-bg-elevated/80 p-5 shadow-glass backdrop-blur-xl">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Money Waterfall</p>
          <p className="font-display text-[20px] font-bold text-fg">Income → Split → Reserve</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-fg-muted">Total Inflow</p>
          <p className="num text-[16px] font-bold text-good">KSh {incomeFormatted}</p>
        </div>
      </div>

      <div className="relative my-4 h-[180px] w-full">
        <svg viewBox="0 0 340 180" className="h-full w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="flow-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--color-good)" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="flow-needs" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0071e3" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="flow-wants" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff9f0a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="flow-goals" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#30d158" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="flow-debt" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff3b30" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>

          <rect
            x="110"
            y="10"
            width="120"
            height="26"
            rx="13"
            fill="url(#flow-bg)"
            className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
            onClick={() => handleTap("income", incomeMinor, 100)}
          />
          <text x="170" y="27" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700">
            Income Flow
          </text>

          <path d="M 170 36 C 170 65, 50 65, 50 110" fill="none" stroke="url(#flow-needs)" strokeWidth={Math.max(3, (needsPct / 100) * 14)} strokeLinecap="round" opacity={activeStream && activeStream !== "needs" ? "0.3" : "0.9"} />
          <path d="M 170 36 C 170 65, 130 65, 130 110" fill="none" stroke="url(#flow-wants)" strokeWidth={Math.max(3, (wantsPct / 100) * 14)} strokeLinecap="round" opacity={activeStream && activeStream !== "wants" ? "0.3" : "0.9"} />
          <path d="M 170 36 C 170 65, 210 65, 210 110" fill="none" stroke="url(#flow-goals)" strokeWidth={Math.max(3, (goalsPct / 100) * 14)} strokeLinecap="round" opacity={activeStream && activeStream !== "goals" ? "0.3" : "0.9"} />
          <path d="M 170 36 C 170 65, 290 65, 290 110" fill="none" stroke="url(#flow-debt)" strokeWidth={Math.max(3, (debtPct / 100) * 14)} strokeLinecap="round" opacity={activeStream && activeStream !== "debt" ? "0.3" : "0.9"} />

          <g className="cursor-pointer" onClick={() => handleTap("needs", needsMinor, needsPct)}>
            <circle cx="50" cy="130" r="22" fill="url(#flow-needs)" />
            <text x="50" y="134" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">Need</text>
          </g>

          <g className="cursor-pointer" onClick={() => handleTap("wants", wantsMinor, wantsPct)}>
            <circle cx="130" cy="130" r="22" fill="url(#flow-wants)" />
            <text x="130" y="134" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">Want</text>
          </g>

          <g className="cursor-pointer" onClick={() => handleTap("goals", goalsMinor, goalsPct)}>
            <circle cx="210" cy="130" r="22" fill="url(#flow-goals)" />
            <text x="210" y="134" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">Goal</text>
          </g>

          <g className="cursor-pointer" onClick={() => handleTap("debt", debtMinor, debtPct)}>
            <circle cx="290" cy="130" r="22" fill="url(#flow-debt)" />
            <text x="290" y="134" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">Debt</text>
          </g>
        </svg>
      </div>

      {activeStream ? (
        <div className="mt-3 rounded-2xl bg-bg-subtle/80 p-3.5 border border-border animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-fg capitalize">{activeStream} Stream</p>
            <p className="num text-[14px] font-bold text-accent">
              KSh {Math.round((activeStream === "income" ? incomeMinor : activeStream === "needs" ? needsMinor : activeStream === "wants" ? wantsMinor : activeStream === "goals" ? goalsMinor : debtMinor) / 100).toLocaleString("en-KE")}
            </p>
          </div>
          <p className="mt-1 text-[12px] text-fg-muted leading-relaxed">
            {activeStream === "income"
              ? "100% of incoming cash enters top of Waterfall before allocations."
              : `${activeStream === "needs" ? needsPct : activeStream === "wants" ? wantsPct : activeStream === "goals" ? goalsPct : debtPct}% of total monthly outflow. Calculated automatically based on your active plan.`}
          </p>
        </div>
      ) : (
        <p className="text-center text-[12px] font-medium text-fg-muted">
          Tap any stream node above to inspect allocation percentage and comparison averages.
        </p>
      )}
    </div>
  );
}

export function BarList({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="mb-1 flex justify-between text-[13px]">
            <span>{bar.label}</span>
            <span className="num text-fg-muted">{formatInt(Math.round(bar.value / 100))}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="progress-fill h-full rounded-full bg-accent"
              style={{ width: `${(bar.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FutureLiquidityScrubber({
  currentLiquid,
  days = [1, 5, 10, 15, 25, 30],
  onScrub,
}: {
  currentLiquid: number;
  days?: number[];
  onScrub?: (dayOffset: number) => void;
}) {
  const [selectedOffset, setSelectedOffset] = useState(0);

  function getProjected(offset: number) {
    const dailySpendEst = 650_00; // estimated KSh 650 daily spend
    const projected = Math.max(0, currentLiquid - offset * dailySpendEst);
    return Math.round(projected / 100);
  }

  function handleSelect(offset: number) {
    setSelectedOffset(offset);
    if (onScrub) onScrub(offset);
  }

  return (
    <div className="rounded-3xl border border-white/15 bg-bg-elevated/80 p-4 shadow-glass backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Scrubbable Liquidity</p>
          <p className="text-[14px] font-bold text-fg">Projected Cash Timeline</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            {selectedOffset === 0 ? "Today" : `+${selectedOffset} Days`}
          </p>
          <p className="num text-[17px] font-bold text-good">
            KSh {getProjected(selectedOffset).toLocaleString("en-KE")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-1.5 overflow-x-auto py-1">
        <button
          type="button"
          onClick={() => handleSelect(0)}
          className={`press h-10 min-w-[50px] rounded-2xl px-2.5 text-[12px] font-bold transition-all border ${
            selectedOffset === 0
              ? "bg-accent text-accent-fg border-accent shadow-md"
              : "bg-bg-subtle/70 text-fg-muted border-border/40 hover:border-border"
          }`}
        >
          Now
        </button>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleSelect(d)}
            className={`press h-10 min-w-[50px] rounded-2xl px-2.5 text-[12px] font-bold transition-all border ${
              selectedOffset === d
                ? "bg-accent text-accent-fg border-accent shadow-md"
                : "bg-bg-subtle/70 text-fg-muted border-border/40 hover:border-border"
            }`}
          >
            +{d}d
          </button>
        ))}
      </div>
    </div>
  );
}

export function HealthRing({ score, label }: { score: number; label: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const to = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-bg-subtle)" strokeWidth="10" />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={to}
            className="chart-line"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-[40px] font-semibold leading-none tracking-tight">{score}</p>
          <p className="mt-1 text-[12px] text-fg-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
