import {
  ChevronRight,
  Landmark,
  LineChart,
  Moon,
  Settings2,
  Sun,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { BarList, MiniLineChart } from "@/components/waterfall/charts";
import { PrimaryAdd } from "@/components/waterfall/budget";
import {
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  Meta,
  Money,
  Pill,
  PrimaryButton,
  ProgressBar,
  SectionLabel,
} from "@/components/waterfall/primitives";
import { emptyCopy, healthForState, investmentCopy, monthFlow, spendByCategory } from "@/lib/waterfall/intelligence";
import { formatMoney, monthKey, todayIso } from "@/lib/waterfall/money";
import { fulizaDailyCost, fulizaOutstanding, fulizaPlan } from "@/lib/waterfall/fuliza";
import { safeToSpend } from "@/lib/waterfall/decision";
import { useUi, useWaterfall } from "@/lib/waterfall/store";
import { useState } from "react";

export function MoreScreen() {
  const page = useUi((s) => s.morePage);
  if (page === "accounts") return <AccountsPage />;
  if (page === "investments") return <InvestmentsPage />;
  if (page === "reports") return <ReportsPage />;
  if (page === "settings") return <SettingsPage />;
  return <MoreMenu />;
}

function MoreMenu() {
  const setMorePage = useUi((s) => s.setMorePage);
  const state = useWaterfall();
  const rows = [
    {
      id: "accounts" as const,
      icon: Landmark,
      title: "Accounts",
      subtitle: `${state.banks.length} linked · ${formatMoney(
        state.banks.reduce((s, b) => s + b.balanceMinor, 0),
      )} liquid`,
    },
    {
      id: "investments" as const,
      icon: TrendingUp,
      title: "Investments",
      subtitle: `${state.investments.length} holdings`,
    },
    {
      id: "reports" as const,
      icon: LineChart,
      title: "Reports",
      subtitle: "Income, spend, mix — no heatmap",
    },
    {
      id: "settings" as const,
      icon: Settings2,
      title: "Settings",
      subtitle: "Profile, theme, currencies",
    },
  ];
  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold tracking-tight">More</h1>
        <Meta>Accounts, investments, reports, and the quiet settings underneath.</Meta>
      </div>
      <GlassCard padded={false}>
        {rows.map((row, i) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setMorePage(row.id)}
            className={`press flex w-full items-center gap-3 px-4 py-4 text-left ${i < rows.length - 1 ? "border-b border-border" : ""}`}
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-bg-subtle text-accent">
              <row.icon className="size-4" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-medium">{row.title}</span>
              <span className="block text-[12px] text-fg-muted">{row.subtitle}</span>
            </span>
            <ChevronRight className="size-4 text-fg-subtle" />
          </button>
        ))}
      </GlassCard>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 text-[13px] font-medium text-accent">
      Back
    </button>
  );
}

function AccountsPage() {
  const setMorePage = useUi((s) => s.setMorePage);
  const openSheet = useUi((s) => s.openSheet);
  const banks = useWaterfall((s) => s.banks);
  const deleteBank = useWaterfall((s) => s.deleteBank);
  const debts = useWaterfall((s) => s.debts);
  const copy = emptyCopy("accounts");
  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <Back onClick={() => setMorePage("menu")} />
      <h1 className="font-display text-[32px] font-semibold tracking-tight">Accounts</h1>
      <Meta>Current is what's there. Available is what's free. Reserved is already spoken for.</Meta>
      <PrimaryAdd onClick={() => openSheet("account")} label="Add account" />
      {banks.length === 0 ? (
        <EmptyState title={copy.title} body={copy.body} />
      ) : (
        banks.map((b) => {
          const avail = Math.max(0, b.availableMinor ?? b.balanceMinor - (b.reservedMinor ?? 0));
          const reserved = b.reservedMinor ?? 0;
          const owed = b.fulizaEnabled ? Math.max(0, b.fulizaOutstandingMinor ?? 0) : 0;
          const fuliza = owed > 0 ? fulizaPlan(b) : null;
          const daily = fuliza ? fuliza.dailyCostMinor : fulizaDailyCost(b);
          return (
            <GlassCard key={b.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[17px] font-semibold tracking-[-0.02em]">{b.nickname || b.accountName}</p>
                  <Meta>
                    {b.bankName}
                    {b.accountNumber ? ` · ···${b.accountNumber.slice(-4)}` : ""}
                    {b.purpose ? ` · ${b.purpose.toLowerCase()}` : ""}
                  </Meta>
                </div>
                {b.isDefault ? <Pill selected>Default</Pill> : null}
              </div>
              <Money minor={b.balanceMinor} className="mt-3 block text-[28px] font-semibold tracking-[-0.03em]" animate />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Meta>Available</Meta>
                  <Money minor={avail} className="block text-[15px] font-semibold" tone={avail <= 0 ? "danger" : "good"} />
                </div>
                <div>
                  <Meta>Reserved</Meta>
                  <Money minor={reserved} className="block text-[15px] font-semibold" />
                </div>
              </div>
              {owed > 0 ? (
                <p className="mt-3 text-[13px] font-medium leading-snug text-danger">
                  <span>Fuliza {formatMoney(owed)}{b.fulizaLimitMinor ? ` of ${formatMoney(b.fulizaLimitMinor)}` : ""}.</span>
                  <span className="mt-1 block">Current estimated charge: {formatMoney(daily)}/day.</span>
                  {fuliza?.projected30DayCostMinor ? <span className="mt-1 block">If untouched, that is roughly {formatMoney(fuliza.projected30DayCostMinor)} of modelled charges over 30 days.</span> : null}
                  <span className="mt-1 block font-semibold">{fuliza?.recommendation}</span>
                </p>
              ) : b.fulizaEnabled ? (
                <p className="mt-3 text-[13px] font-medium text-good">Fuliza on, nothing outstanding.</p>
              ) : null}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="text-[13px] font-semibold text-accent"
                  onClick={() => openSheet("account", b.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-[13px] font-semibold text-danger"
                  onClick={() => deleteBank(b.id)}
                >
                  Delete
                </button>
              </div>
            </GlassCard>
          );
        })
      )}
      <SectionLabel>Debt</SectionLabel>
      {debts.length === 0 ? (
        <Meta>No other debt on the books. Fuliza lives on the M-PESA account, not here.</Meta>
      ) : (
        debts.map((d) => {
          const pct = d.originalMinor > 0 ? 1 - d.remainingMinor / d.originalMinor : 1;
          return (
            <GlassCard key={d.id}>
              <p className="font-display text-[17px] font-semibold">{d.name}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Meta>Remaining</Meta>
                  <Money minor={d.remainingMinor} className="block text-lg font-semibold" tone="danger" />
                </div>
                <div>
                  <Meta>Monthly</Meta>
                  <Money minor={d.paymentMinor} className="block text-lg font-semibold" />
                </div>
              </div>
              <ProgressBar className="mt-3" value={pct} tone={pct >= 0.7 ? "good" : pct >= 0.4 ? "warn" : "danger"} />
              <Meta className="mt-2">
                At your current repayment rate, you'll finish this around{" "}
                {new Date(
                  Date.now() +
                    Math.max(1, Math.ceil(d.remainingMinor / Math.max(1, d.paymentMinor)) - 1) * 30 * 86400000,
                ).toLocaleString("en-KE", { month: "long" })}
                .
              </Meta>
            </GlassCard>
          );
        })
      )}
    </div>
  );
}

function InvestmentsPage() {
  const setMorePage = useUi((s) => s.setMorePage);
  const openSheet = useUi((s) => s.openSheet);
  const investments = useWaterfall((s) => s.investments);
  const currency = useWaterfall((s) => s.profile.baseCurrencyCode);
  const copy = emptyCopy("investments");
  const total = investments.reduce((s, i) => s + i.valueMinor, 0);
  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <Back onClick={() => setMorePage("menu")} />
      <h1 className="font-display text-[32px] font-semibold tracking-tight">Investments</h1>
      <GlassCard>
        <Meta>Total value</Meta>
        <Money minor={total} className="mt-1 block text-[36px] font-semibold" animate />
      </GlassCard>
      <PrimaryAdd onClick={() => openSheet("investment")} label="Add holding" />
      {investments.length === 0 ? (
        <EmptyState title={copy.title} body={copy.body} />
      ) : (
        investments.map((inv) => {
          const gain = inv.valueMinor - inv.costMinor;
          return (
            <GlassCard key={inv.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-[17px] font-semibold">{inv.name}</p>
                  <Meta>{inv.kind}</Meta>
                </div>
                <span className={gain >= 0 ? "text-good text-[13px] font-medium" : "text-danger text-[13px] font-medium"}>
                  {gain >= 0 ? "+" : ""}
                  {formatMoney(gain, currency)}
                </span>
              </div>
              <Money minor={inv.valueMinor} className="mt-2 block text-2xl font-semibold" />
              <Meta className="mt-2">{investmentCopy(inv, currency)}</Meta>
            </GlassCard>
          );
        })
      )}
    </div>
  );
}

export function MonthlyCinematicSummaryCard() {
  return (
    <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 p-5 text-white shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Monthly Summary</p>
        <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold text-accent border border-accent/30">
          September
        </span>
      </div>

      <p className="font-display text-[26px] font-bold text-white mt-2 leading-tight">
        Your Financial Month
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Biggest Win</p>
          <p className="text-[14px] font-medium text-slate-200 mt-0.5">
            Transport spending decreased 12% compared to last month.
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Opportunity</p>
          <p className="text-[14px] font-medium text-slate-200 mt-0.5">
            Food & groceries increased 18% — Waterfall protected rent and savings anyway.
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Best Move</p>
          <p className="text-[14px] font-medium text-slate-200 mt-0.5">
            You maintained a positive cash buffer for three consecutive months.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const setMorePage = useUi((s) => s.setMorePage);
  const state = useWaterfall();
  const copy = emptyCopy("reports");
  const month = monthKey(todayIso());
  const spend = spendByCategory(state.transactions, month);
  const flow = monthFlow(state.incomeEntries, 6);
  const health = healthForState(state);
  const mix = [
    { label: "Essentials", value: state.items.filter((i) => i.bucket === "NEED").reduce((s, i) => s + i.currentMinor, 0) },
    { label: "Lifestyle", value: state.items.filter((i) => i.bucket === "WANT").reduce((s, i) => s + i.currentMinor, 0) },
    { label: "Goals", value: state.items.filter((i) => i.bucket === "GOAL").reduce((s, i) => s + i.currentMinor, 0) },
  ].filter((x) => x.value > 0);
  const hasData = state.transactions.length > 0 || state.incomeEntries.length > 0;

  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <Back onClick={() => setMorePage("menu")} />
      <h1 className="font-display text-[32px] font-semibold tracking-tight">Reports</h1>
      <MonthlyCinematicSummaryCard />
      {!hasData ? (
        <EmptyState title={copy.title} body={copy.body} />
      ) : (
        <>
          <GlassCard>
            <SectionLabel>Income, six months</SectionLabel>
            <MiniLineChart className="mt-3" points={flow.map((f) => f.income)} />
          </GlassCard>
          <GlassCard>
            <SectionLabel>This month's mix</SectionLabel>
            <div className="mt-3">
              {mix.length ? <BarList bars={mix} /> : <Meta>No mix yet.</Meta>}
            </div>
          </GlassCard>
          <GlassCard>
            <SectionLabel>Spending by category</SectionLabel>
            <div className="mt-3">
              {spend.length ? (
                <BarList bars={spend.slice(0, 7).map((s) => ({ label: s.label, value: s.value }))} />
              ) : (
                <Meta>No expenses this month.</Meta>
              )}
            </div>
          </GlassCard>
          <GlassCard>
            <SectionLabel>Health drivers</SectionLabel>
            <div className="mt-3 flex flex-col gap-3">
              {health.parts.map((p) => (
                <div key={p.key}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span>{p.label}</span>
                    <span className="num">{p.score}</span>
                  </div>
                  <ProgressBar value={p.score / 100} />
                  <Meta className="mt-1">{p.detail}</Meta>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}

function SettingsPage() {
  const setMorePage = useUi((s) => s.setMorePage);
  const profile = useWaterfall((s) => s.profile);
  const currencies = useWaterfall((s) => s.currencies);
  const updateProfile = useWaterfall((s) => s.updateProfile);
  const setTheme = useWaterfall((s) => s.setTheme);
  const saveCurrencyRate = useWaterfall((s) => s.saveCurrencyRate);
  const resetDemo = useWaterfall((s) => s.resetDemo);
  const [name, setName] = useState(profile.displayName);
  const [birthday, setBirthday] = useState(profile.birthdayIso ?? "");
  const [tightness, setTightness] = useState(profile.tightness ?? "managing");
  const [payDay, setPayDay] = useState(profile.payDay ?? "25");
  const [rates, setRates] = useState(() => Object.fromEntries(currencies.map((c) => [c.code, String(c.rateToBase)])));
  const [dev, setDev] = useState(false);

  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <Back onClick={() => setMorePage("menu")} />
      <h1 className="font-display text-[32px] font-semibold tracking-tight">Settings</h1>
      <GlassCard>
        <SectionLabel>Profile</SectionLabel>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Display name" value={name} onChange={setName} placeholder="Ivan" />
          <Field label="Birthday" value={birthday} onChange={setBirthday} type="date" />
          <Field label="Usual payday" value={payDay} onChange={setPayDay} placeholder="25, 1, 15, or end" />
          <div className="flex flex-wrap gap-2">
            {(["comfortable", "managing", "stretched", "crisis"] as const).map((t) => (
              <Pill key={t} selected={tightness === t} urgent={t === "crisis"} onClick={() => setTightness(t)}>
                {t === "crisis" ? "In a hole" : t[0].toUpperCase() + t.slice(1)}
              </Pill>
            ))}
          </div>
          <Field label="Base currency" value="KES" onChange={() => {}} />
          <Meta>Base currency is locked to Kenyan Shilling. Everything else converts in at entry.</Meta>
          <PrimaryButton
            onClick={() =>
              updateProfile({ displayName: name, birthdayIso: birthday || null, tightness, payDay: payDay || "25" })
            }
          >
            Save profile
          </PrimaryButton>
        </div>
      </GlassCard>
      <GlassCard>
        <SectionLabel>Appearance & Palette</SectionLabel>
        <Meta className="mt-1">Whites, greys, layered surfaces with jewellery accent color.</Meta>
        <div className="mt-4 flex rounded-full border border-border bg-bg-subtle p-1">
          <button
            type="button"
            onClick={() => setTheme("LIGHT")}
            className={`press flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium ${profile.themeMode === "LIGHT" ? "bg-bg-elevated shadow-sm" : "text-fg-muted"}`}
          >
            <Sun className="size-4" /> Light
          </button>
          <button
            type="button"
            onClick={() => setTheme("DARK")}
            className={`press flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium ${profile.themeMode === "DARK" ? "bg-bg-elevated shadow-sm" : "text-fg-muted"}`}
          >
            <Moon className="size-4" /> Dark
          </button>
        </div>

        <p className="mt-4 mb-2 text-[12px] font-semibold text-fg-muted uppercase tracking-wider">Waterfall Personal Identity Accent</p>
        <div className="flex flex-wrap gap-2">
          {(["ocean", "rose", "iris", "emerald", "amber", "aurora", "graphite"] as const).map((p) => {
            const setPaletteTheme = useWaterfall.getState().setPaletteTheme;
            const current = profile.paletteTheme ?? "ocean";
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPaletteTheme(p)}
                className={`press flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold border transition-all ${
                  current === p
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-bg-subtle/60 text-fg-muted hover:text-fg"
                }`}
              >
                <span className={`size-2.5 rounded-full ${p === "ocean" ? "bg-sky-500" : p === "rose" ? "bg-rose-500" : p === "iris" ? "bg-purple-500" : p === "emerald" ? "bg-emerald-500" : p === "amber" ? "bg-amber-500" : p === "aurora" ? "bg-blue-600" : "bg-slate-500"}`} />
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            );
          })}
        </div>
      </GlassCard>
      <GlassCard>
        <button type="button" className="flex w-full items-center justify-between" onClick={() => setDev((v) => !v)}>
          <SectionLabel>Developer options</SectionLabel>
          <ChevronRight className={`size-4 text-fg-subtle transition-transform ${dev ? "rotate-90" : ""}`} />
        </button>
        {dev ? (
          <div className="mt-3 flex flex-col gap-3">
            <Meta>Offline FX defaults, used only when income arrives in another currency.</Meta>
            {currencies
              .filter((c) => c.code !== "KES")
              .slice(0, 8)
              .map((c) => (
                <div key={c.code} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field
                      label={`${c.code} → KES`}
                      value={rates[c.code] ?? ""}
                      onChange={(v) => setRates((s) => ({ ...s, [c.code]: v }))}
                      inputMode="decimal"
                    />
                  </div>
                  <GhostButton
                    className="h-12 px-3"
                    onClick={() => saveCurrencyRate(c.code, Number(rates[c.code]) || c.rateToBase)}
                  >
                    Save
                  </GhostButton>
                </div>
              ))}
          </div>
        ) : null}
      </GlassCard>
      <GlassCard>
        <SectionLabel>Data</SectionLabel>
        <Meta className="mt-1">Everything lives on this device. No account, no cloud, no network.</Meta>
        <GhostButton className="mt-3 w-full" onClick={resetDemo}>
          Restore demo data
        </GhostButton>
      </GlassCard>
      <p className="px-1 text-center text-[12px] text-fg-subtle">Waterfall · offline · KES</p>
    </div>
  );
}

export function SourcesHint() {
  const sources = useWaterfall((s) => s.sources);
  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-accent" />
        <SectionLabel>Income sources</SectionLabel>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {sources.map((s) => (
          <Meta key={s.id}>
            {s.label} · {s.allowedScopes.join(" · ").toLowerCase()}
          </Meta>
        ))}
      </div>
    </GlassCard>
  );
}
