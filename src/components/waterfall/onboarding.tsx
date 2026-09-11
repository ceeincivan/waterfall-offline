import { useMemo, useState } from "react";
import { ComputingPlan } from "@/components/waterfall/loading";
import { PrimaryButton, SecondaryButton } from "@/components/waterfall/primitives";
import { INSTITUTIONS, purposeForKind, searchInstitutions } from "@/lib/waterfall/banks";
import { nextBirthdayIso } from "@/lib/waterfall/fuliza";
import { parseAmountMinor, todayIso } from "@/lib/waterfall/money";
import { useWaterfall } from "@/lib/waterfall/store";
import type { FundingMode, Tightness } from "@/lib/waterfall/types";

const SOURCES = ["Salary", "Business", "Freelance", "Pension", "Allowance", "Multiple sources", "Other"] as const;
const FREQUENCIES = ["Monthly", "Twice a month", "Weekly", "Irregular"] as const;
const PAYDAYS = ["1", "5", "15", "25", "end"] as const;
const TIGHTNESS: { id: Tightness; label: string; hint: string }[] = [
  { id: "comfortable", label: "Comfortable", hint: "Bills are covered and there is room to choose." },
  { id: "managing", label: "Managing", hint: "It works, but large surprises hurt." },
  { id: "stretched", label: "Stretched", hint: "Cash needs careful timing." },
  { id: "crisis", label: "In a hole", hint: "Stability and essentials come before everything else." },
];
const DEPENDENTS = ["Just me", "Partner", "Children", "Parents or siblings", "A mix"] as const;
const PROTECTIONS = ["Housing", "Food", "Transport", "Utilities", "Emergency reserve", "Debt", "Savings goals"] as const;

const STEPS = [
  ["Let's build your money system", "A few answers become real budgets, priorities and calculations. Nothing here is decorative."],
  ["When is your birthday?", "Only used to create an optional birthday goal and deadline."],
  ["What currency do you use?", "This becomes your base currency for balances, budgets and receipts."],
  ["Where does your income come from?", "Waterfall uses this label to learn income history and detect unusual payments."],
  ["How often does money arrive?", "This changes the runway Waterfall plans between income events."],
  ["When does it usually arrive?", "This gives Safe to Spend a real next-income date instead of guessing 21 days."],
  ["How much usually arrives?", "This becomes the baseline for future allocation and windfall detection."],
  ["What does your household need each month?", "These amounts become live recurring envelopes on your Plan screen."],
  ["How much is already in the account?", "This is the starting liquidity Waterfall uses immediately."],
  ["Do you currently owe Fuliza?", "Enter the actual outstanding balance. Waterfall then models cost and repayment pressure from that balance."],
  ["What should never get sacrificed first?", "These protections directly shape your reserve floor and allocation priorities."],
] as const;

export function Onboarding() {
  const saveBank = useWaterfall((s) => s.saveBank);
  const saveSource = useWaterfall((s) => s.saveSource);
  const saveItem = useWaterfall((s) => s.saveItem);
  const updateProfile = useWaterfall((s) => s.updateProfile);
  const setPrefs = useWaterfall((s) => s.setPrefs);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [birthdaySkip, setBirthdaySkip] = useState(false);
  const [birthdayEnvelope, setBirthdayEnvelope] = useState(true);
  const [currency, setCurrency] = useState("KES");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("Salary");
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>("Monthly");
  const [payDay, setPayDay] = useState<(typeof PAYDAYS)[number]>("25");
  const [amount, setAmount] = useState("80000");
  const [tightness, setTightness] = useState<Tightness>("managing");
  const [dependents, setDependents] = useState<(typeof DEPENDENTS)[number]>("Just me");
  const [housing, setHousing] = useState("45000");
  const [food, setFood] = useState("28000");
  const [transport, setTransport] = useState("12000");
  const [utilities, setUtilities] = useState("8000");
  const [emergencyTarget, setEmergencyTarget] = useState("100000");
  const [bank, setBank] = useState("M-PESA");
  const [bankQuery, setBankQuery] = useState("");
  const [customBank, setCustomBank] = useState("");
  const [balance, setBalance] = useState("");
  const [reserved, setReserved] = useState("");
  const [usesFuliza, setUsesFuliza] = useState<"no" | "yes">("no");
  const [fulizaOut, setFulizaOut] = useState("");
  const [fulizaLimit, setFulizaLimit] = useState("20000");
  const [protect, setProtect] = useState<string[]>(["Housing", "Food", "Transport", "Emergency reserve"]);
  const [finishing, setFinishing] = useState(false);

  const banks = useMemo(() => {
    const found = searchInstitutions(bankQuery);
    return found.length ? found : INSTITUTIONS;
  }, [bankQuery]);

  function finish() {
    const institution = bank === "Other" ? customBank.trim() || "Other" : bank;
    const kind = INSTITUTIONS.find((i) => i.name === institution)?.kind ?? "other";
    const isMpesa = kind === "mpesa" || /m-?pesa/i.test(institution);
    const currentMinor = parseAmountMinor(balance, currency);
    const reservedMinor = parseAmountMinor(reserved, currency);
    const availableMinor = Math.max(0, currentMinor - reservedMinor);
    const fulizaOutstanding = usesFuliza === "yes" ? parseAmountMinor(fulizaOut, currency) : 0;
    const fulizaCap = usesFuliza === "yes" ? parseAmountMinor(fulizaLimit, currency) : 0;
    const typical = parseAmountMinor(amount, currency);

    const bankId = saveBank({
      bankName: institution,
      accountName: isMpesa ? "Mobile money" : "Primary",
      accountNumber: "",
      nickname: institution,
      currencyCode: currency,
      balanceMinor: currentMinor,
      availableMinor,
      reservedMinor,
      active: true,
      isDefault: true,
      purpose: purposeForKind(kind),
      accountType: isMpesa ? "MOBILE" : "CURRENT",
      fulizaEnabled: isMpesa && usesFuliza === "yes",
      fulizaOutstandingMinor: isMpesa ? fulizaOutstanding : 0,
      fulizaLimitMinor: isMpesa ? fulizaCap : 0,
      lastBalanceIso: todayIso(),
    });

    if (usesFuliza === "yes" && !isMpesa) {
      saveBank({
        bankName: "M-PESA",
        accountName: "Mobile money",
        accountNumber: "",
        nickname: "M-PESA",
        currencyCode: currency,
        balanceMinor: 0,
        availableMinor: 0,
        reservedMinor: 0,
        active: true,
        isDefault: false,
        purpose: "MPESA",
        accountType: "MOBILE",
        fulizaEnabled: true,
        fulizaOutstandingMinor: fulizaOutstanding,
        fulizaLimitMinor: fulizaCap,
        lastBalanceIso: todayIso(),
      });
    }

    saveSource({
      label: source,
      defaultBankId: bankId,
      allowedScopes: ["NEED", "WANT", "GOAL", "BANK"],
      selectedItemIds: [],
      currencyCode: currency,
      fxRateToBase: 1,
      active: true,
    });

    const birthdayIso = birthdaySkip || !birthday ? null : birthday;
    updateProfile({
      displayName: name.trim() || "Friend",
      baseCurrencyCode: currency,
      birthdayIso,
      tightness,
      dependents,
      payDay: frequency === "Irregular" ? "varies" : payDay,
      incomeFrequency: frequency,
    });

    const essentials = [
      ["Housing", housing, 1],
      ["Food", food, 2],
      ["Transport", transport, 3],
      ["Utilities", utilities, 4],
    ] as const;
    for (const [label, value, priority] of essentials) {
      const target = parseAmountMinor(value, currency);
      if (target <= 0) continue;
      saveItem({
        bucket: "NEED",
        label,
        targetMinor: target,
        currentMinor: 0,
        currencyCode: currency,
        dueDateIso: label === "Housing" ? `${todayIso().slice(0, 8)}01` : null,
        priority: protect.includes(label) ? priority : priority + 4,
        recurring: true,
        frequencyMonths: 1,
        active: true,
        note: "Created from your setup answers.",
        category: label,
        importance: "ESSENTIAL",
      });
    }

    const emergency = parseAmountMinor(emergencyTarget, currency);
    if (emergency > 0 && protect.includes("Emergency reserve")) {
      saveItem({
        bucket: "GOAL",
        label: "Emergency reserve",
        targetMinor: emergency,
        currentMinor: 0,
        currencyCode: currency,
        dueDateIso: null,
        priority: 1,
        recurring: false,
        frequencyMonths: 0,
        active: true,
        note: "Reserve target created from onboarding.",
        category: "Emergency",
        importance: "GOAL",
      });
    }

    if (birthdayIso && birthdayEnvelope) {
      const next = nextBirthdayIso(birthdayIso, todayIso()) ?? birthdayIso;
      saveItem({
        bucket: "GOAL",
        label: "Birthday",
        targetMinor: parseAmountMinor("15000", currency),
        currentMinor: 0,
        currencyCode: currency,
        dueDateIso: next,
        priority: 2,
        recurring: true,
        frequencyMonths: 12,
        frequencyCode: "YEARLY",
        active: true,
        note: "Birthday envelope created from onboarding.",
        category: "BIRTHDAY",
        periodKey: next.slice(0, 4),
        importance: "GOAL",
      });
    }

    const mode: FundingMode =
      tightness === "crisis" ? "RECOVERY" : tightness === "stretched" ? "SAFE" : tightness === "comfortable" ? "BALANCED" : "SMART";
    const monthlyEssentials = [housing, food, transport, utilities].reduce((sum, v) => sum + parseAmountMinor(v, currency), 0);
    const reserveFloor = protect.includes("Emergency reserve")
      ? Math.max(parseAmountMinor("5000", currency), Math.round(Math.min(typical * 0.2, monthlyEssentials * 0.5)))
      : parseAmountMinor("5000", currency);

    setPrefs({
      onboarded: true,
      lastIncomeLabel: source,
      lastIncomeMinor: typical,
      minReserveMinor: tightness === "crisis" ? Math.round(reserveFloor * 0.5) : reserveFloor,
      fundingMode: mode,
      protectedLabels: protect,
    });
  }

  function goNext() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      setFinishing(true);
      window.setTimeout(finish, 650);
    }
  }

  if (finishing) {
    return <div className="flex h-full flex-col bg-bg px-5 pt-14 pb-8"><p className="text-[12px] font-bold uppercase tracking-[0.16em] text-fg-subtle">Waterfall</p><div className="mt-8"><ComputingPlan kind="setup" /></div></div>;
  }

  const current = STEPS[step];
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg px-5 pb-7 pt-11">
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-accent/8 blur-3xl" />
      <header className="relative z-10 flex items-center justify-between">
        <div><p className="text-[12px] font-bold uppercase tracking-[0.18em] text-fg">Waterfall</p><p className="mt-0.5 text-[10px] font-semibold text-fg-subtle">Build your system once</p></div>
        <div className="text-[11px] font-bold tabular-nums text-fg-muted">{step + 1} / {STEPS.length}</div>
      </header>
      <div className="relative z-10 mt-7"><h1 className="max-w-[18ch] font-display text-[29px] font-bold leading-[1.08] tracking-[-0.04em]">{current[0]}</h1><p className="mt-2 max-w-[35ch] text-[13px] leading-relaxed text-fg-muted">{current[1]}</p></div>

      <div className="relative z-10 mt-6 min-h-0 flex-1 overflow-y-auto rounded-[28px] border border-border bg-bg-elevated p-5 shadow-sm">
        {step === 0 ? <div className="space-y-4"><Field label="Your name" value={name} onChange={setName} placeholder="What should Waterfall call you?" /><div className="rounded-2xl bg-accent-soft p-4"><p className="text-[13px] font-bold text-accent">Your answers become live data.</p><p className="mt-1 text-[12px] leading-relaxed text-fg-muted">Income becomes an income baseline. Expenses become recurring envelopes. Your balance becomes starting liquidity. Fuliza becomes a real debt calculation.</p></div></div> : null}
        {step === 1 ? <div className="space-y-3"><Field label="Birthday" value={birthday} onChange={(v) => { setBirthday(v); setBirthdaySkip(false); }} type="date" /><OptionRow label="Skip birthday" on={birthdaySkip} onClick={() => { setBirthdaySkip(true); setBirthday(""); }} />{!birthdaySkip ? <OptionRow label="Create a birthday envelope" hint="Optional goal; change the amount later." on={birthdayEnvelope} onClick={() => setBirthdayEnvelope((v) => !v)} /> : null}</div> : null}
        {step === 2 ? <ChipGrid options={["KES", "USD", "GBP", "EUR", "TZS", "UGX"]} value={currency} onChange={setCurrency} /> : null}
        {step === 3 ? <OptionList options={[...SOURCES]} value={source} onChange={setSource} /> : null}
        {step === 4 ? <OptionList options={[...FREQUENCIES]} value={frequency} onChange={setFrequency} /> : null}
        {step === 5 ? <div className="space-y-2">{PAYDAYS.map((d) => <OptionRow key={d} label={d === "end" ? "Last working day" : `${d}${d === "1" ? "st" : "th"} of the month`} on={payDay === d} onClick={() => setPayDay(d)} />)}</div> : null}
        {step === 6 ? <Field label="Typical income" value={amount} onChange={setAmount} placeholder="80,000" inputMode="decimal" /> : null}
        {step === 7 ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field label="Housing" value={housing} onChange={setHousing} inputMode="decimal" /><Field label="Food" value={food} onChange={setFood} inputMode="decimal" /><Field label="Transport" value={transport} onChange={setTransport} inputMode="decimal" /><Field label="Utilities" value={utilities} onChange={setUtilities} inputMode="decimal" /></div><Field label="Emergency reserve target" value={emergencyTarget} onChange={setEmergencyTarget} inputMode="decimal" /><OptionList options={[...DEPENDENTS]} value={dependents} onChange={setDependents} /></div> : null}
        {step === 8 ? <div className="space-y-3"><div className="flex flex-wrap gap-2">{banks.slice(0, 12).map((b) => <button key={b.name} type="button" onClick={() => setBank(b.name)} className={`rounded-2xl border px-3 py-2 text-[13px] font-bold ${bank === b.name ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg text-fg-muted"}`}>{b.name}</button>)}</div><Field label="Search institution" value={bankQuery} onChange={setBankQuery} placeholder="Equity, KCB, M-PESA…" /><Field label="Current balance" value={balance} onChange={setBalance} placeholder="0" inputMode="decimal" /><Field label="Already reserved" value={reserved} onChange={setReserved} placeholder="0" inputMode="decimal" />{bank === "Other" ? <Field label="Institution name" value={customBank} onChange={setCustomBank} /> : null}</div> : null}
        {step === 9 ? <div className="space-y-3"><OptionRow label="No Fuliza outstanding" hint="Waterfall will ignore Fuliza debt until you add it." on={usesFuliza === "no"} onClick={() => setUsesFuliza("no")} /><OptionRow label="Yes, I owe Fuliza" hint="The amount below drives the daily-cost and payoff calculations." on={usesFuliza === "yes"} onClick={() => setUsesFuliza("yes")} tone="warn" />{usesFuliza === "yes" ? <><Field label="Outstanding now" value={fulizaOut} onChange={setFulizaOut} placeholder="200" inputMode="decimal" /><Field label="Fuliza limit" value={fulizaLimit} onChange={setFulizaLimit} placeholder="20,000" inputMode="decimal" /><p className="rounded-2xl bg-bg-subtle p-3 text-[12px] leading-relaxed text-fg-muted">A KSh 200 balance is treated as a small KSh 200 balance. Waterfall does not add a random KSh 30/day fee.</p></> : null}</div> : null}
        {step === 10 ? <div className="space-y-2">{TIGHTNESS.map((t) => <OptionRow key={t.id} label={t.label} hint={t.hint} on={tightness === t.id} onClick={() => setTightness(t.id)} tone={t.id === "crisis" ? "danger" : t.id === "stretched" ? "warn" : t.id === "comfortable" ? "good" : undefined} />)}<div className="mt-4 border-t border-border pt-4">{PROTECTIONS.map((p) => { const on = protect.includes(p); return <button key={p} type="button" onClick={() => setProtect(on ? protect.filter((x) => x !== p) : [...protect, p])} className={`mb-2 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${on ? "border-accent/30 bg-accent-soft" : "border-border bg-bg"}`}><span className="text-[13px] font-semibold">{p}</span><span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{on ? "Protected" : "Optional"}</span></button>; })}</div></div> : null}
      </div>

      <div className="relative z-10 mt-4 flex gap-3"><SecondaryButton className="h-12 flex-1" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Back</SecondaryButton><PrimaryButton className="h-12 flex-[2]" onClick={goNext}>{step === STEPS.length - 1 ? "Build my plan" : "Continue"}</PrimaryButton></div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: "decimal" | "numeric" | "text" }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-fg-subtle">{label}</span><input type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-bg px-4 text-[15px] font-semibold text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" /></label>;
}

function OptionRow({ label, hint, on, onClick, tone }: { label: string; hint?: string; on: boolean; onClick: () => void; tone?: "good" | "warn" | "danger" }) {
  const toneText = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-accent";
  return <button type="button" onClick={onClick} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${on ? "border-accent/35 bg-accent-soft" : "border-border bg-bg"}`}><span className="min-w-0"><span className="block text-[14px] font-bold">{label}</span>{hint ? <span className="mt-1 block text-[11px] leading-relaxed text-fg-muted">{hint}</span> : null}</span><span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${on ? toneText : "text-fg-subtle"}`}>{on ? "Selected" : "Select"}</span></button>;
}

function OptionList<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) { return <div className="space-y-2">{options.map((o) => <OptionRow key={o} label={o} on={value === o} onClick={() => onChange(o)} />)}</div>; }
function ChipGrid<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) { return <div className="flex flex-wrap gap-2">{options.map((o) => <button key={o} type="button" onClick={() => onChange(o)} className={`h-11 rounded-2xl border px-4 text-[13px] font-bold ${value === o ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg text-fg-muted"}`}>{o}</button>)}</div>; }
