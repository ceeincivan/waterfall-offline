import { ShieldCheck, WalletCards } from "lucide-react";
import { formatMoney } from "@/lib/waterfall/money";
import { expectedNextIncome } from "@/lib/waterfall/tradeoff";
import { liquidOf, savingsOf } from "@/lib/waterfall/decision";
import { totalFuliza } from "@/lib/waterfall/fuliza";
import type { WaterfallState } from "@/lib/waterfall/types";

export function FinancialRadar({ state, today }: { state: WaterfallState; today: string }) {
  const liquid = liquidOf(state);
  const reserve = state.prefs.minReserveMinor;
  const savings = savingsOf(state);
  const debt = totalFuliza(state);
  const next = expectedNextIncome(state.incomeEntries, today, state.profile.payDay, state.profile.incomeFrequency);
  const flowTotal = Math.max(1, liquid + savings + debt);
  const liquidPct = Math.min(100, Math.round((liquid / flowTotal) * 100));
  const reservePct = Math.min(100, Math.round((reserve / Math.max(1, liquid)) * 100));

  return (
    <section className="rounded-[26px] border border-border bg-bg-elevated/75 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-fg-subtle">Financial radar</p>
          <p className="mt-1 text-[13px] font-semibold text-fg">Where your money is sitting</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent"><WalletCards className="size-4" /></span>
      </div>

      <div className="mt-4 flow-track h-2">
        <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${liquidPct}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <RadarStat label="Liquid" value={formatMoney(liquid)} />
        <RadarStat label="Protected" value={formatMoney(savings)} />
        <RadarStat label="Fuliza" value={formatMoney(debt)} danger={debt > 0} />
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-bg-subtle/70 px-3 py-2.5">
        <ShieldCheck className="size-4 shrink-0 text-good" />
        <p className="min-w-0 flex-1 text-[11px] font-medium leading-relaxed text-fg-muted">
          {reserve > 0 ? `${formatMoney(reserve)} is your current cash floor.` : "You have no cash floor yet."}
          {next.iso ? ` Next income: ${next.iso}.` : " Income timing is uncertain."}
        </p>
        <span className="text-[10px] font-bold text-fg-subtle">{reservePct}%</span>
      </div>
    </section>
  );
}

function RadarStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return <div className="metric-tile rounded-2xl p-3"><div className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${danger ? "bg-danger" : "bg-accent"}`} /><span className="text-[9px] font-bold uppercase tracking-[0.13em] text-fg-subtle">{label}</span></div><p className={`mt-1 text-[12px] font-black tabular-nums ${danger ? "text-danger" : "text-fg"}`}>{value}</p></div>;
}
