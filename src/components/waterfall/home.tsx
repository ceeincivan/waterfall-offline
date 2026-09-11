import { ArrowDownLeft, ArrowUpRight, ChevronRight, ShieldAlert, Sparkles } from "lucide-react";
import { FutureLiquidityScrubber } from "@/components/waterfall/charts";
import { FinancialRadar } from "@/components/waterfall/financial-radar";
import { AnimatedNumber, Group, GroupRow, Meta, Money, PrimaryButton } from "@/components/waterfall/primitives";
import { expectedNextIncome } from "@/lib/waterfall/tradeoff";
import { formatIso, nextBestMove, outlook, safeToSpend, upcoming } from "@/lib/waterfall/decision";
import { availableOf, fulizaOutstanding, fulizaPlan, nextBirthdayIso, totalFuliza } from "@/lib/waterfall/fuliza";
import { daysBetween, formatMoney, greetingFor, remainingOf, todayIso } from "@/lib/waterfall/money";
import { displayName, useUi, useWaterfall } from "@/lib/waterfall/store";
import { cn } from "@/lib/utils";
import type { WaterfallState } from "@/lib/waterfall/types";

export function HomeScreen() {
  const state = useWaterfall();
  const openSheet = useUi((s) => s.openSheet);
  const setTab = useUi((s) => s.setTab);
  const setMorePage = useUi((s) => s.setMorePage);
  const today = todayIso();
  const safe = safeToSpend(state, today);
  const view = outlook(state, today);
  const name = displayName(state);
  const next = expectedNextIncome(state.incomeEntries, today, state.profile.payDay, state.profile.incomeFrequency);
  const move = nextBestMove(state, today);
  const essentials = upcoming(state, today, 30).filter((x) => x.item.bucket === "NEED").slice(0, 3);
  const accounts = state.banks.filter((b) => b.active);
  const fulizaBanks = accounts.filter((b) => fulizaOutstanding(b) > 0);
  const fuliza = totalFuliza(state);
  const fulizaDaily = fulizaBanks.reduce((sum, b) => sum + (fulizaPlan(b)?.dailyCostMinor ?? 0), 0);
  const bday = nextBirthdayIso(state.profile.birthdayIso, today);
  const bdayDays = bday ? daysBetween(today, bday) : null;
  const birthdayGoal = state.items.find((i) => i.active && /birthday/i.test(i.label));
  const confidence = state.lastConfidence || "medium";
  const heroTone = safe.amountMinor <= 0 ? (view.tone === "danger" ? "text-danger" : "text-warn") : view.tone === "good" ? "text-good" : view.tone === "warn" ? "text-warn" : "text-fg";

  return (
    <div className="stagger flex flex-col gap-5 pb-12">
      <header className="flex items-center justify-between px-1 pt-2">
        <div><p className="text-[13px] font-semibold tracking-wide text-fg-muted uppercase">{greetingFor()}{name !== "there" ? `, ${name}` : ""}</p><p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-fg-subtle">Your money, right now</p></div>
        <button type="button" onClick={() => openSheet("ask")} className="press flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1.5 text-[12px] font-bold text-accent border border-accent/20"><Sparkles className="size-3.5" />Ask</button>
      </header>

      <section className="safe-hero relative overflow-hidden rounded-[30px] border border-accent/20 bg-gradient-to-br from-accent/15 via-bg-elevated to-bg-elevated p-6 shadow-float">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative"><div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-fg-subtle">Safe to spend</span><span className="rounded-full bg-bg/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fg-muted border border-border">{confidence} confidence</span></div>
          <div className="mt-4 flex items-baseline gap-2"><span className="text-lg font-bold text-fg-muted">KSh</span><AnimatedNumber value={Math.round(safe.amountMinor / 100)} className={cn("font-display text-[56px] font-black leading-none tracking-[-0.055em]", heroTone)} /></div>
          <p className="mt-2 max-w-[32ch] text-[14px] font-semibold leading-snug text-fg">{view.headline}</p>
          <p className="mt-1.5 max-w-[38ch] text-[12px] font-medium leading-relaxed text-fg-muted">{safe.why}</p>
          <div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Cash" value={formatMoney(safe.liquidMinor)} /><Stat label="Floor" value={formatMoney(state.prefs.minReserveMinor)} /><Stat label="Next" value={next.minor > 0 ? formatMoney(next.minor) : "—"} /></div>
          <PrimaryButton className="mt-5 h-13 w-full text-[15px] font-bold" onClick={() => openSheet("income")}>Money in</PrimaryButton>
        </div>
      </section>

      <FinancialRadar state={state} today={today} />

      <FutureLiquidityScrubber currentLiquid={safe.liquidMinor} />

      {fuliza > 0 ? <FulizaCard state={state} fuliza={fuliza} daily={fulizaDaily} onOpen={() => { setTab("more"); setMorePage("accounts"); }} /> : null}

      {essentials.length > 0 ? <Group title="Next up" action={<button type="button" className="text-[12px] font-bold text-accent" onClick={() => setTab("plan")}>See plan</button>}>{essentials.map((p, i) => <GroupRow key={p.item.id} label={p.item.label} value={formatMoney(p.remainingMinor)} hint={p.reason} last={i === essentials.length - 1} tone={p.level === "critical" ? "danger" : p.level === "high" ? "warn" : undefined} onClick={() => openSheet("item-detail", p.item.id)} />)}</Group> : null}

      {bday && bdayDays != null && bdayDays <= 45 ? <section className="rounded-3xl border border-accent/25 bg-accent-soft/60 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Coming up</p><p className="mt-1 font-display text-[18px] font-bold">{bdayDays === 0 ? "Birthday today" : `${formatIso(bday)} · ${bdayDays} days`}</p><p className="mt-1 text-[12px] font-medium text-fg-muted">{birthdayGoal && remainingOf(birthdayGoal) > 0 ? `${formatMoney(remainingOf(birthdayGoal))} still needed for the birthday goal.` : "Birthday goal is fully funded."}</p></section> : null}

      <Group title="Waterfall says" action={<button type="button" className="text-[12px] font-bold text-accent" onClick={() => openSheet("ask")}>Ask why</button>}><button type="button" onClick={() => openSheet("ask")} className="flex w-full items-start gap-3 px-4 py-4 text-left"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Sparkles className="size-4" /></div><p className="text-[14px] font-semibold leading-relaxed">{move}</p><ChevronRight className="mt-1 size-4 shrink-0 text-fg-subtle" /></button></Group>

      {accounts.length > 0 ? <Group title="Money locations" action={<button type="button" className="text-[12px] font-bold text-accent" onClick={() => { setTab("more"); setMorePage("accounts"); }}>Manage</button>}>{accounts.slice(0, 3).map((b, i) => { const owed = fulizaOutstanding(b); return <button key={b.id} type="button" onClick={() => { setTab("more"); setMorePage("accounts"); }} className={cn("w-full px-4 py-3.5 text-left", i < Math.min(3, accounts.length) - 1 && "border-b border-border/60")}><div className="flex items-baseline justify-between gap-3"><p className="truncate text-[14px] font-bold">{b.nickname || b.bankName}</p><Money minor={b.balanceMinor} className="text-[14px] font-bold" /></div><p className="mt-1 text-[11px] font-medium text-fg-muted">Available {formatMoney(availableOf(b))}{b.reservedMinor > 0 ? ` · ${formatMoney(b.reservedMinor)} reserved` : ""}{owed > 0 ? ` · Fuliza ${formatMoney(owed)}` : ""}</p></button>; })}</Group> : <Group title="Money locations"><button type="button" onClick={() => { setTab("more"); setMorePage("accounts"); }} className="flex w-full items-center justify-between px-4 py-4 text-left"><span className="text-[14px] font-semibold">Add your M-PESA or bank</span><ChevronRight className="size-4 text-fg-subtle" /></button></Group>}

      <button type="button" onClick={() => openSheet("expense")} className="press flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-bg-elevated text-[14px] font-bold shadow-sm"><ArrowDownLeft className="size-4 text-danger" />Log an expense</button>
      <Meta className="text-center">Waterfall only surfaces what needs your attention. The ledger remains the source of truth.</Meta>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-border/60 bg-bg/45 p-3"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fg-subtle">{label}</p><p className="mt-1 truncate text-[12px] font-bold text-fg">{value}</p></div>; }
function FulizaCard({ state, fuliza, daily, onOpen }: { state: WaterfallState; fuliza: number; daily: number; onOpen: () => void }) {
  const first = state.banks.find((b) => fulizaOutstanding(b) > 0);
  const plan = first ? fulizaPlan(first, 0) : null;
  const smallBalance = fuliza <= 50_000;
  return <button type="button" onClick={onOpen} className="press group w-full rounded-[26px] border border-danger/20 bg-danger/8 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-danger/12"><ShieldAlert className="size-4 text-danger" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-danger">Fuliza</p><p className="text-[11px] font-semibold text-fg-muted">{smallBalance ? "Small balance — clear it quickly" : "Debt is costing you every day"}</p></div></div><span className="rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-bold text-danger">{formatMoney(daily)}/day</span></div>
    <div className="mt-4 flex items-end justify-between gap-4"><div><p className="font-display text-[30px] font-black tracking-[-0.04em] text-danger">{formatMoney(fuliza)}</p><p className="mt-1 text-[11px] font-medium text-fg-muted">Modelled 30-day maintenance: {formatMoney(plan?.projected30DayCostMinor ?? daily * 30)}</p></div>{plan?.recommendedPaymentMinor ? <div className="text-right"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fg-subtle">Clear with</p><p className="mt-1 text-[15px] font-black">{formatMoney(plan.recommendedPaymentMinor)}</p></div> : null}</div>
    <p className="mt-3 text-[12px] font-medium leading-relaxed text-fg-muted">{plan?.recommendation ?? "Keep essentials covered, then reduce the balance."}</p>
    <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-danger"><ArrowUpRight className="size-3.5" />Open account plan <span className="ml-auto opacity-50 transition group-hover:translate-x-0.5">→</span></div>
  </button>;
}
