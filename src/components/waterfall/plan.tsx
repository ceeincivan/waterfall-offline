import { useState } from "react";
import { BudgetScreen } from "@/components/waterfall/budget";
import { InteractiveWaterfallFlow } from "@/components/waterfall/charts";
import { GoalsScreen } from "@/components/waterfall/goals";
import { Pill } from "@/components/waterfall/primitives";
import { FUNDING_MODES } from "@/lib/waterfall/decision";
import { totalFuliza } from "@/lib/waterfall/fuliza";
import type { FundingMode } from "@/lib/waterfall/types";
import { useUi, useWaterfall } from "@/lib/waterfall/store";

export function PlanScreen() {
  const [seg, setSeg] = useState<"flow" | "must" | "goals">("flow");
  const state = useWaterfall();
  const prefs = state.prefs;
  const setPrefs = state.setPrefs;
  const openSheet = useUi((s) => s.openSheet);

  const incomeMinor = state.prefs.lastIncomeMinor || 80_000_00;
  const needsMinor = state.items.filter((i) => i.active && i.bucket === "NEED").reduce((s, i) => s + i.targetMinor, 0);
  const wantsMinor = state.items.filter((i) => i.active && i.bucket === "WANT").reduce((s, i) => s + i.targetMinor, 0);
  const goalsMinor = state.items.filter((i) => i.active && i.bucket === "GOAL").reduce((s, i) => s + i.targetMinor, 0);
  const debtMinor = totalFuliza(state) || state.debts.reduce((s, d) => s + d.paymentMinor, 0);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="px-1 pt-1 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[34px] font-semibold leading-none tracking-[-0.035em]">Plan</h1>
          <p className="mt-2 text-[15px] text-fg-muted">Must Pay, Lifestyle, and Goals. Waterfall handles the split.</p>
        </div>
        <button
          type="button"
          onClick={() => openSheet("scenario")}
          className="press rounded-2xl bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent border border-accent/30"
        >
          What-if?
        </button>
      </header>

      <div>
        <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-muted">Funding mode</p>
        <div className="flex flex-wrap gap-2">
          {FUNDING_MODES.map((m) => (
            <Pill key={m.id} selected={prefs.fundingMode === m.id} onClick={() => setPrefs({ fundingMode: m.id as FundingMode })}>
              {m.label}
            </Pill>
          ))}
        </div>
        <p className="mt-2 px-1 text-[13px] text-fg-muted">
          {FUNDING_MODES.find((m) => m.id === prefs.fundingMode)?.blurb}
        </p>
      </div>

      <div className="flex rounded-full bg-bg-subtle p-1">
        <button
          type="button"
          className={`h-9 flex-1 rounded-full text-[13px] font-bold ${seg === "flow" ? "bg-bg-elevated shadow-glass text-fg" : "text-fg-muted"}`}
          onClick={() => setSeg("flow")}
        >
          Flow
        </button>
        <button
          type="button"
          className={`h-9 flex-1 rounded-full text-[13px] font-bold ${seg === "must" ? "bg-bg-elevated shadow-glass text-fg" : "text-fg-muted"}`}
          onClick={() => setSeg("must")}
        >
          Must Pay
        </button>
        <button
          type="button"
          className={`h-9 flex-1 rounded-full text-[13px] font-bold ${seg === "goals" ? "bg-bg-elevated shadow-glass text-fg" : "text-fg-muted"}`}
          onClick={() => setSeg("goals")}
        >
          Goals
        </button>
      </div>

      {seg === "flow" ? (
        <InteractiveWaterfallFlow
          incomeMinor={incomeMinor}
          needsMinor={needsMinor}
          wantsMinor={wantsMinor}
          goalsMinor={goalsMinor}
          debtMinor={debtMinor}
        />
      ) : seg === "must" ? (
        <BudgetScreen />
      ) : (
        <GoalsScreen />
      )}
    </div>
  );
}
