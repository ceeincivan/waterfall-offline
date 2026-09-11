import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const COMPUTE_SCRIPTS = {
  income: {
    title: "Placing this money",
    subtitle: "Across what you need, what's coming, and what should stay untouched.",
    steps: ["Checking essentials", "Balancing what's due", "Leaving a reserve"],
  },
  emergency: {
    title: "Recalculating your plan",
    subtitle: "Essentials stay protected. Lifestyle and flexible goals move first.",
    steps: ["Protecting rent and food", "Drawing from lifestyle first", "Updating the plan"],
  },
  commit: {
    title: "Saving the allocation",
    subtitle: "This is the plan Waterfall will keep.",
    steps: ["Locking the split", "Writing it down"],
  },
  setup: {
    title: "Setting up your Waterfall",
    subtitle: "Accounts, protections, and a starting plan — on this phone only.",
    steps: ["Saving your accounts", "Setting protections", "Opening Waterfall"],
  },
  receipt: {
    title: "Writing the receipt",
    subtitle: "A record of this allocation, kept on this phone.",
    steps: ["Laying out the plan", "Saving the receipt"],
  },
} as const;

export type ComputeKind = keyof typeof COMPUTE_SCRIPTS;

const BOOT_MESSAGES = ["Preparing your money…", "Checking what's due…", "Finding safe to spend…"];

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("shimmer", className)} aria-hidden />;
}

export function HomeSkeleton() {
  const message = useCycled(BOOT_MESSAGES, 900);
  return (
    <div className="flex h-full flex-col bg-bg px-5 pt-3" role="status" aria-live="polite" aria-busy="true">
      <Shimmer className="h-3.5 w-36 rounded-full" />

      <div className="mt-8">
        <div className="flex items-end gap-2">
          <span className="mb-2 text-[17px] font-medium text-fg-muted">KSh</span>
          <Shimmer className="h-[52px] w-44 rounded-[18px]" />
        </div>
        <p className="mt-2 text-[15px] text-fg-muted">Safe to spend</p>
        <p className="mt-1 text-[14px] leading-snug text-fg-subtle">{message}</p>
        <Shimmer className="mt-5 h-12 w-full rounded-full" />
      </div>

      <p className="mb-2 mt-8 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-muted">Next</p>
      <div className="overflow-hidden rounded-[12px] bg-bg-elevated">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow last />
      </div>

      <p className="mb-2 mt-7 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-muted">Your money</p>
      <div className="overflow-hidden rounded-[12px] bg-bg-elevated">
        <SkeletonRow />
        <SkeletonRow last />
      </div>

      <p className="mb-2 mt-7 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-muted">Waterfall's recommendation</p>
      <div className="overflow-hidden rounded-[12px] bg-bg-elevated">
        <div className="px-4 py-3.5">
          <Shimmer className="h-3.5 w-[88%] rounded-full" />
          <Shimmer className="mt-2 h-3 w-[62%] rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ComputingPlan({
  kind,
  title,
  subtitle,
}: {
  kind: ComputeKind;
  title?: string;
  subtitle?: string;
}) {
  const script = COMPUTE_SCRIPTS[kind];
  const steps = script.steps;
  const active = useStaged(steps.length, 320);
  const progress = Math.min(1, (active + 0.18) / steps.length);

  return (
    <div className="flex flex-col gap-5 py-1" role="status" aria-live="polite" aria-busy="true">
      <div>
        <p className="font-display text-[22px] font-semibold tracking-tight">{title ?? script.title}</p>
        <p className="mt-1 text-[14px] leading-snug text-fg-muted">{subtitle ?? script.subtitle}</p>
      </div>

      <div className="h-[3px] w-full overflow-hidden rounded-full bg-bg-subtle">
        <div className="compute-progress h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  done && "bg-accent text-accent-fg",
                  current && "compute-dot bg-accent-soft text-accent",
                  !done && !current && "bg-bg-subtle text-fg-subtle",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-[15px]", done || current ? "text-fg" : "text-fg-subtle")}>{step}</span>
            </li>
          );
        })}
      </ol>

      <div className="overflow-hidden rounded-[12px] bg-bg-elevated">
        <SkeletonRow wide reveal={active >= 0} />
        <SkeletonRow reveal={active >= 1} />
        <SkeletonRow reveal={active >= 1} />
        <SkeletonRow last reveal={active >= 2} />
      </div>
    </div>
  );
}

function SkeletonRow({ last, wide, reveal = true }: { last?: boolean; wide?: boolean; reveal?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3.5 transition-opacity duration-300",
        !last && "border-b border-border",
        reveal ? "opacity-100" : "opacity-40",
      )}
    >
      <div className="min-w-0 flex-1">
        <Shimmer className={cn("h-3.5 rounded-full", wide ? "w-[70%]" : "w-[46%]")} />
        <Shimmer className="mt-2 h-2.5 w-[30%] rounded-full" />
      </div>
      <Shimmer className="h-3.5 w-16 shrink-0 rounded-full" />
    </div>
  );
}

function useStaged(count: number, interval: number) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setActive(Math.max(0, count - 1));
      return;
    }
    const id = window.setInterval(() => {
      setActive((i) => Math.min(i + 1, count - 1));
    }, interval);
    return () => window.clearInterval(id);
  }, [count, interval]);
  return active;
}

function useCycled(items: string[], interval: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % items.length), interval);
    return () => window.clearInterval(id);
  }, [items.length, interval]);
  return items[i] ?? items[0];
}
