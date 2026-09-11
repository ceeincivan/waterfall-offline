import { useMemo, useState } from "react";
import { ComputingPlan } from "@/components/waterfall/loading";
import {
  Field,
  GhostButton,
  GlassCard,
  LargeKeypad,
  Meta,
  Money,
  Pill,
  PrimaryButton,
  Sheet,
} from "@/components/waterfall/primitives";
import { formatMoney, todayIso } from "@/lib/waterfall/money";
import { bucketForImportance, inferImportance } from "@/lib/waterfall/financial-state";
import type { Decision } from "@/lib/waterfall/decision";
import {
  FREQUENCY_OPTIONS,
  inferFrequencyCode,
  monthsForFrequency,
  type CustomUnit,
  type FrequencyCode,
} from "@/lib/waterfall/frequency";
import { useUi, useWaterfall } from "@/lib/waterfall/store";
import { downloadReceipt } from "@/lib/waterfall/receipt-file";

export function Sheets() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  return (
    <>
      <Sheet open={sheet === "income"} onClose={close} title="Money in">
        <IncomeForm />
      </Sheet>
      <Sheet open={sheet === "expense"} onClose={close} title="Something came up">
        <ExpenseForm />
      </Sheet>
      <Sheet open={sheet === "transfer"} onClose={close} title="Transfer">
        <TransferForm />
      </Sheet>
      <Sheet open={sheet === "goal"} onClose={close} title="New goal">
        <GoalForm />
      </Sheet>
      <Sheet open={sheet === "budget-item"} onClose={close} title="Add something to fund">
        <BudgetForm />
      </Sheet>
      <Sheet open={sheet === "account"} onClose={close} title="Add account">
        <AccountForm />
      </Sheet>
      <Sheet open={sheet === "investment"} onClose={close} title="Add holding">
        <InvestmentForm />
      </Sheet>
      <Sheet open={sheet === "receipt"} onClose={close} title="Allocation receipt">
        <ReceiptView />
      </Sheet>
      <Sheet open={sheet === "item-detail"} onClose={close} title="Edit">
        <ItemDetail />
      </Sheet>
      <Sheet open={sheet === "ask"} onClose={close} title="Ask Waterfall">
        <AskView />
      </Sheet>
      <Sheet open={sheet === "scenario"} onClose={close} title="What-If Simulator">
        <ScenarioView />
      </Sheet>
    </>
  );
}

function IncomeForm() {
  const sources = useWaterfall((s) => s.sources);
  const banks = useWaterfall((s) => s.banks);
  const prefs = useWaterfall((s) => s.prefs);
  const logIncome = useWaterfall((s) => s.logIncome);
  const previewIncome = useWaterfall((s) => s.previewIncome);
  const openSheet = useUi((s) => s.openSheet);
  const close = useUi((s) => s.closeSheet);
  const [sourceId, setSourceId] = useState<number | null>(sources[0]?.id ?? null);
  const [label, setLabel] = useState(prefs.lastIncomeLabel || sources[0]?.label || "Salary");
  const [amount, setAmount] = useState(prefs.lastIncomeMinor ? String(Math.round(prefs.lastIncomeMinor / 100)) : "");
  const [bankId, setBankId] = useState<number | null>(banks.find((b) => b.isDefault)?.id ?? banks[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"form" | "computing" | "plan" | "committing">("form");
  const [decision, setDecision] = useState<Decision | null>(null);

  const kinds = ["Salary", "Freelance", "Business", "Gift", "Bonus", "Other"];
  const filteredBanks = banks.filter((b) =>
    `${b.bankName} ${b.nickname ?? ""} ${b.accountName}`.toLowerCase().includes(query.toLowerCase()),
  );

  if (phase === "computing") {
    return <ComputingPlan kind="income" />;
  }
  if (phase === "committing") {
    return <ComputingPlan kind="commit" />;
  }
  if (phase === "plan" && decision) {
    const rows = [...decision.plan.itemLines.filter((l) => l.amountMinor > 0), ...(decision.plan.bankLine ? [decision.plan.bankLine] : [])];
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-display text-[22px] font-semibold">Waterfall's plan</p>
          <p className="mt-1 text-[14px] text-fg-muted">{formatMoney(decision.plan.incomeMinor)} allocated</p>
        </div>
        <div className="overflow-hidden rounded-[12px] bg-bg-elevated">
          {rows.map((line, i) => (
            <div key={`${line.label}-${i}`} className={`flex items-start justify-between gap-3 px-4 py-3.5 ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{line.label}</p>
                {line.note ? <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{line.note}</p> : null}
              </div>
              <p className="num shrink-0 text-[15px] font-medium">{formatMoney(line.amountMinor)}</p>
            </div>
          ))}
        </div>
        {decision.explanations.slice(0, 3).map((n) => (
          <p key={n} className="text-[13px] leading-snug text-fg-muted">{n}</p>
        ))}
        <PrimaryButton
          className="w-full"
          onClick={() => {
            setPhase("committing");
            window.setTimeout(() => {
              logIncome({
                sourceId,
                sourceLabel: label || "Income",
                amountText: amount,
                currencyCode: "KES",
                bankId,
                allowedScopes: ["NEED", "WANT", "GOAL"],
                selectedItemIds: [],
              });
              openSheet("receipt");
            }, 720);
          }}
        >
          Accept plan
        </PrimaryButton>
        <GhostButton className="w-full" onClick={() => setPhase("form")}>
          Adjust amount
        </GhostButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="How much did you receive?" value={amount} onChange={setAmount} placeholder="50000" inputMode="decimal" />
      <div>
        <p className="mb-2 text-[12px] font-medium text-fg-muted">Where did it come from?</p>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <Pill
              key={k}
              selected={label === k}
              onClick={() => {
                setLabel(k);
                const src = sources.find((s) => s.label === k);
                setSourceId(src?.id ?? null);
              }}
            >
              {k}
            </Pill>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12px] font-medium text-fg-muted">Where did it arrive?</p>
        {banks.length > 4 ? (
          <Field label="Search" value={query} onChange={setQuery} placeholder="Equity, M-PESA…" />
        ) : null}
        <div className="mt-2 flex flex-col gap-1">
          {(query ? filteredBanks : banks).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBankId(b.id)}
              className={`flex min-h-11 items-center justify-between rounded-[16px] px-3 text-left ${bankId === b.id ? "bg-accent-soft" : "bg-bg-subtle"}`}
            >
              <span className="min-w-0 truncate text-[15px] font-medium">{b.nickname || b.bankName}</span>
              <span className="shrink-0 text-[12px] text-fg-muted">
                {b.purpose === "MPESA" ? "M-PESA" : b.purpose === "CASH" ? "Cash" : "Bank"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <PrimaryButton
        className="w-full"
        disabled={!amount}
        onClick={() => {
          setPhase("computing");
          window.setTimeout(() => {
            const preview = previewIncome({
              sourceId,
              sourceLabel: label || "Income",
              amountText: amount,
              currencyCode: "KES",
              bankId,
            });
            if (!preview) {
              setPhase("form");
              return;
            }
            setDecision(preview);
            setPhase("plan");
          }, 980);
        }}
      >
        See Waterfall's plan
      </PrimaryButton>
    </div>
  );
}

function ScenarioView() {
  const state = useWaterfall();
  const [extraSave, setExtraSave] = useState(2000);
  const goal = state.items.find((i) => i.active && i.bucket === "GOAL" && i.targetMinor > i.currentMinor);
  const goalRemaining = goal ? Math.round((goal.targetMinor - goal.currentMinor) / 100) : 50000;

  const normalMonths = Math.max(1, Math.ceil(goalRemaining / 3500));
  const newMonths = Math.max(1, Math.ceil(goalRemaining / (3500 + extraSave)));
  const daysFaster = Math.max(0, (normalMonths - newMonths) * 30);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[12px] font-bold uppercase tracking-wider text-accent">What-If Engine</p>
        <p className="font-display text-[22px] font-bold text-fg">Simulate Future Impact</p>
        <p className="text-[13px] text-fg-muted mt-0.5">
          See how extra monthly contributions accelerate your goal target.
        </p>
      </div>

      <div className="rounded-3xl bg-accent-soft/60 p-5 border border-accent/30 text-center">
        <p className="text-[12px] font-bold uppercase tracking-wider text-accent">Goal Trajectory</p>
        <p className="font-display text-[32px] font-bold text-fg mt-1">
          {daysFaster > 0 ? `${daysFaster} days earlier!` : "Standard trajectory"}
        </p>
        <p className="text-[13px] text-fg-muted mt-1">
          {goal ? `Target: ${goal.label} (KSh ${goalRemaining.toLocaleString("en-KE")} left)` : "Emergency Fund"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex justify-between text-[13px] font-bold text-fg">
          <span>Extra Monthly Allocation</span>
          <span className="num text-accent">+KSh {extraSave.toLocaleString("en-KE")}</span>
        </label>
        <div className="flex gap-2">
          {[1000, 2000, 5000, 10000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setExtraSave(amt)}
              className={`press flex-1 h-11 rounded-2xl text-[13px] font-bold border transition-all ${
                extraSave === amt
                  ? "bg-accent text-accent-fg border-accent shadow-md"
                  : "bg-bg-subtle/70 text-fg-muted border-border/40 hover:border-border"
              }`}
            >
              +{amt >= 1000 ? `${amt / 1000}k` : amt}
            </button>
          ))}
        </div>
      </div>

      <GlassCard>
        <div className="flex justify-between text-[14px]">
          <span className="text-fg-muted">Standard Completion:</span>
          <span className="font-bold text-fg">{normalMonths} months</span>
        </div>
        <div className="flex justify-between text-[14px] mt-2">
          <span className="text-fg-muted">Accelerated Completion:</span>
          <span className="font-bold text-good">{newMonths} months</span>
        </div>
      </GlassCard>
    </div>
  );
}

function AskView() {
  const state = useWaterfall();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const SUGGESTIONS = [
    "Can I afford KSh 15,000?",
    "Where did my money go?",
    "Why am I spending more?",
    "What should I do with this salary?",
    "How much can I safely spend today?",
  ];

  function handleAsk(q: string) {
    setQuery(q);
    const ans = import("@/lib/waterfall/decision").then((m) => m.askWaterfall(state, q));
    void ans.then((res) => setAnswer(res));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wider text-fg-muted">Ask anything about your money</p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Spent 450 on matatu, Can I afford KSh 15,000?"
            className="h-12 flex-1 rounded-2xl border border-border bg-bg-subtle/80 px-4 text-[15px] outline-none focus:border-accent"
          />
          <PrimaryButton onClick={() => handleAsk(query)} disabled={!query.trim()}>
            Ask
          </PrimaryButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleAsk(s)}
            className="press rounded-full bg-bg-subtle/70 px-3 py-1.5 text-[12px] font-semibold text-fg-muted hover:text-fg border border-border/40"
          >
            {s}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="mt-2 rounded-2xl bg-accent-soft/50 p-4 border border-accent/30 animate-in fade-in duration-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Waterfall Reasoning</p>
          <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-fg">{answer}</p>
        </div>
      ) : null}
    </div>
  );
}

function ExpenseForm() {
  const banks = useWaterfall((s) => s.banks);
  const logExpense = useWaterfall((s) => s.logExpense);
  const reallocation = useWaterfall((s) => s.lastReallocation);
  const close = useUi((s) => s.closeSheet);
  const [naturalText, setNaturalText] = useState("");
  const [kind, setKind] = useState("Unexpected bill");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | null>(banks.find((b) => b.isDefault)?.id ?? banks[0]?.id ?? null);
  const [phase, setPhase] = useState<"form" | "computing" | "done">("form");
  const kinds = ["Medical", "Emergency travel", "Urgent repair", "Unexpected bill", "Other"];

  function handleNaturalChange(val: string) {
    setNaturalText(val);
    import("@/lib/waterfall/decision").then((m) => {
      const parsed = m.parseKenyanNaturalInput(val);
      if (parsed.amountText) setAmount(parsed.amountText);
      if (parsed.category) setKind(parsed.category);
    });
  }

  if (phase === "computing") {
    return <ComputingPlan kind="emergency" />;
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-[22px] font-semibold">Your plan changed.</p>
        <p className="text-[15px] leading-snug text-fg-muted">
          {reallocation?.explanation ?? "Lifestyle and flexible goals absorbed this first. Essentials stayed protected."}
        </p>
        {reallocation?.drains.slice(0, 4).map((d) => (
          <div key={`${d.label}-${d.takenMinor}`} className="flex items-center justify-between text-[14px]">
            <span className="text-fg-muted">{d.label}</span>
            <span className="num font-medium">−{formatMoney(d.takenMinor)}</span>
          </div>
        ))}
        {reallocation?.delayedGoals.length ? (
          <p className="text-[13px] text-fg-muted">{reallocation.delayedGoals[0]} has been delayed.</p>
        ) : null}
        <PrimaryButton className="w-full" onClick={close}>
          Done
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Natural Kenyan Input"
        value={naturalText}
        onChange={handleNaturalChange}
        placeholder="e.g. Nimetumia 450 kwa matatu, 1200 naivas"
      />

      <div className="rounded-3xl bg-bg-elevated/90 p-4 border border-border/60 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Amount</p>
        <p className="font-mono text-[42px] font-bold tracking-tight text-accent mt-1">
          KSh {amount ? Number(amount).toLocaleString("en-KE") : "0"}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-fg-muted">Suggested Category</p>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <Pill key={k} selected={kind === k} onClick={() => setKind(k)}>
              {k}
            </Pill>
          ))}
        </div>
      </div>

      <LargeKeypad value={amount} onChange={setAmount} onConfirm={() => {}} />
      <div className="flex flex-wrap gap-2">
        {banks.map((b) => (
          <Pill key={b.id} selected={accountId === b.id} onClick={() => setAccountId(b.id)}>
            {b.nickname || b.bankName}
          </Pill>
        ))}
      </div>

      <PrimaryButton
        className="w-full h-13 text-[16px] font-bold"
        disabled={!amount || Number(amount) <= 0}
        onClick={() => {
          setPhase("computing");
          window.setTimeout(() => {
            logExpense({
              payee: kind,
              category: kind,
              amountText: amount,
              accountId,
              itemId: null,
              isoDate: todayIso(),
              note: kind,
            });
            setPhase("done");
          }, 980);
        }}
      >
        Recalculate Waterfall Plan
      </PrimaryButton>
    </div>
  );
}

function TransferForm() {
  const banks = useWaterfall((s) => s.banks);
  const logTransfer = useWaterfall((s) => s.logTransfer);
  const close = useUi((s) => s.closeSheet);
  const [fromId, setFrom] = useState<number>(banks[0]?.id ?? 0);
  const [toId, setTo] = useState<number>(banks[1]?.id ?? banks[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] font-medium text-fg-muted">From</p>
      <div className="flex flex-wrap gap-2">
        {banks.map((b) => (
          <Pill key={b.id} selected={fromId === b.id} onClick={() => setFrom(b.id)}>
            {b.nickname || b.bankName}
          </Pill>
        ))}
      </div>
      <p className="text-[12px] font-medium text-fg-muted">To</p>
      <div className="flex flex-wrap gap-2">
        {banks.map((b) => (
          <Pill key={b.id} selected={toId === b.id} onClick={() => setTo(b.id)}>
            {b.nickname || b.bankName}
          </Pill>
        ))}
      </div>
      <Field label="Amount" value={amount} onChange={setAmount} placeholder="0" inputMode="decimal" />
      <PrimaryButton
        className="w-full"
        onClick={() => {
          logTransfer({ fromId, toId, amountText: amount });
          close();
        }}
      >
        Move money
      </PrimaryButton>
    </div>
  );
}

function GoalForm() {
  const saveItem = useWaterfall((s) => s.saveItem);
  const close = useUi((s) => s.closeSheet);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name" value={label} onChange={setLabel} placeholder="Japan Trip" />
      <Field label="Target" value={target} onChange={setTarget} placeholder="150000" inputMode="decimal" />
      <Field label="Already saved" value={current} onChange={setCurrent} placeholder="0" inputMode="decimal" />
      <Field label="Target date" value={due} onChange={setDue} type="date" />
      <PrimaryButton
        className="w-full"
        onClick={() => {
          if (!label || !target) return;
          saveItem({
            bucket: "GOAL",
            label,
            targetMinor: Math.round(Number(target.replace(/,/g, "")) * 100) || 0,
            currentMinor: Math.round(Number(current.replace(/,/g, "") || "0") * 100) || 0,
            currencyCode: "KES",
            dueDateIso: due || null,
            priority: 2,
            recurring: false,
            frequencyMonths: 0,
            active: true,
            note: null,
            category: "Savings",
          });
          close();
        }}
      >
        Save goal
      </PrimaryButton>
    </div>
  );
}

function BudgetForm() {
  const saveItem = useWaterfall((s) => s.saveItem);
  const close = useUi((s) => s.closeSheet);
  const presets = ["Rent", "Food", "Transport", "Electricity", "Water", "Internet", "School", "Insurance", "Debt", "Other"];
  const dues = ["1", "5", "10", "15", "20", "25"];
  const [preset, setPreset] = useState("Rent");
  const [label, setLabel] = useState("Rent");
  const [target, setTarget] = useState("");
  const [importance, setImportance] = useState<"ESSENTIAL" | "IMPORTANT" | "FLEXIBLE" | "GOAL" | "ASK">("ESSENTIAL");
  const [dueDay, setDueDay] = useState("1");
  const [freq, setFreq] = useState<FrequencyCode>("MONTHLY");
  const [customEvery, setCustomEvery] = useState("17");
  const [customUnit, setCustomUnit] = useState<CustomUnit>("days");
  const custom = preset === "Other";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] font-medium text-fg-muted">What is it?</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Pill
            key={p}
            selected={preset === p}
            onClick={() => {
              setPreset(p);
              if (p !== "Other") {
                setLabel(p);
                const inferred = inferImportance(p);
                if (inferred) setImportance(inferred);
              } else {
                setLabel("");
                setImportance("ASK");
              }
            }}
          >
            {p}
          </Pill>
        ))}
      </div>
      {custom ? <Field label="Name" value={label} onChange={setLabel} placeholder="Cancer treatment" /> : null}
      <Field label="How much?" value={target} onChange={setTarget} placeholder="25000" inputMode="decimal" />
      {(custom || importance === "ASK") ? (
        <div>
          <p className="mb-2 text-[12px] font-medium text-fg-muted">How important is this?</p>
          <div className="flex flex-wrap gap-2">
            {(["ESSENTIAL", "IMPORTANT", "FLEXIBLE", "GOAL"] as const).map((k) => (
              <Pill key={k} selected={importance === k} onClick={() => setImportance(k)}>
                {k === "ESSENTIAL" ? "Essential" : k === "IMPORTANT" ? "Important" : k === "FLEXIBLE" ? "Flexible" : "Goal"}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}
      <FrequencyField
        freq={freq}
        onFreq={setFreq}
        customEvery={customEvery}
        onCustomEvery={setCustomEvery}
        customUnit={customUnit}
        onCustomUnit={setCustomUnit}
      />
      {freq !== "ONCE" && freq !== "DAILY" ? (
        <div>
          <p className="mb-2 text-[12px] font-medium text-fg-muted">When is it normally due?</p>
          <div className="flex flex-wrap gap-2">
            {dues.map((d) => (
              <Pill key={d} selected={dueDay === d} onClick={() => setDueDay(d)}>
                {d}{d === "1" ? "st" : d === "5" ? "th" : "th"}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}
      <PrimaryButton
        className="w-full"
        onClick={() => {
          if (!label || !target) return;
          const kind = importance === "ASK" ? inferImportance(label) ?? "FLEXIBLE" : importance;
          const today = new Date();
          const due = new Date(today.getFullYear(), today.getMonth(), Number(dueDay));
          if (due < today) due.setMonth(due.getMonth() + 1);
          const months = monthsForFrequency(freq, Number(customEvery) || 1, customUnit);
          saveItem({
            bucket: bucketForImportance(kind),
            label,
            targetMinor: Math.round(Number(target.replace(/,/g, "")) * 100) || 0,
            currentMinor: 0,
            currencyCode: "KES",
            dueDateIso: freq !== "ONCE" && freq !== "DAILY" ? due.toISOString().slice(0, 10) : null,
            priority: kind === "ESSENTIAL" ? 1 : kind === "IMPORTANT" ? 2 : 4,
            recurring: freq !== "ONCE",
            frequencyMonths: months,
            frequencyCode: freq,
            customEvery: freq === "CUSTOM" ? Number(customEvery) || 1 : undefined,
            customUnit: freq === "CUSTOM" ? customUnit : undefined,
            active: true,
            note: null,
            category: label,
            periodKey: todayIso().slice(0, 7),
            importance: kind,
          });
          close();
        }}
      >
        Done
      </PrimaryButton>
    </div>
  );
}

function AccountForm() {
  const saveBank = useWaterfall((s) => s.saveBank);
  const close = useUi((s) => s.closeSheet);
  const id = useUi((s) => s.sheetItemId);
  const existing = useWaterfall((s) => s.banks.find((b) => b.id === id));
  const [bankName, setBankName] = useState(existing?.bankName ?? "");
  const [accountName, setAccountName] = useState(existing?.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber ?? "");
  const [nickname, setNickname] = useState(existing?.nickname ?? "");
  const [current, setCurrent] = useState(existing ? String(Math.round(existing.balanceMinor / 100)) : "");
  const [reserved, setReserved] = useState(existing ? String(Math.round((existing.reservedMinor ?? 0) / 100)) : "");
  const [isDefault, setDefault] = useState(existing?.isDefault ?? false);
  const [fulizaOn, setFulizaOn] = useState(existing?.fulizaEnabled ?? /m-?pesa/i.test(existing?.bankName ?? ""));
  const [fulizaOut, setFulizaOut] = useState(
    existing?.fulizaOutstandingMinor ? String(Math.round(existing.fulizaOutstandingMinor / 100)) : "",
  );
  const [fulizaLimit, setFulizaLimit] = useState(
    existing?.fulizaLimitMinor ? String(Math.round(existing.fulizaLimitMinor / 100)) : "",
  );
  const isMpesa = /m-?pesa/i.test(bankName) || existing?.purpose === "MPESA" || existing?.accountType === "MOBILE";

  return (
    <div className="flex flex-col gap-4">
      <Field label="Bank" value={bankName} onChange={setBankName} placeholder="Equity Bank" />
      <Field label="Account name" value={accountName} onChange={setAccountName} placeholder="Current" />
      <Field label="Account number" value={accountNumber} onChange={setAccountNumber} />
      <Field label="Nickname" value={nickname} onChange={setNickname} placeholder="Everyday" />
      <Field label="Current balance" value={current} onChange={setCurrent} placeholder="0" inputMode="decimal" />
      <Field
        label="Reserved"
        value={reserved}
        onChange={setReserved}
        placeholder="0"
        inputMode="decimal"
      />
      <Pill selected={isDefault} onClick={() => setDefault((v) => !v)}>
        Default bank
      </Pill>
      {(isMpesa || fulizaOn) ? (
        <>
          <Pill selected={fulizaOn} onClick={() => setFulizaOn((v) => !v)}>
            Fuliza on this M-PESA
          </Pill>
          {fulizaOn ? (
            <>
              <Field label="Fuliza outstanding" value={fulizaOut} onChange={setFulizaOut} placeholder="0" inputMode="decimal" />
              <Field label="Fuliza limit" value={fulizaLimit} onChange={setFulizaLimit} placeholder="20000" inputMode="decimal" />
            </>
          ) : null}
        </>
      ) : null}
      <PrimaryButton
        className="w-full"
        onClick={() => {
          if (!bankName) return;
          const balanceMinor = Math.round(Number(current.replace(/,/g, "") || "0") * 100) || 0;
          const reservedMinor = Math.round(Number(reserved.replace(/,/g, "") || "0") * 100) || 0;
          saveBank({
            id: existing?.id,
            bankName,
            accountName: accountName || bankName,
            accountNumber: accountNumber,
            nickname: nickname || null,
            currencyCode: existing?.currencyCode ?? "KES",
            balanceMinor,
            reservedMinor,
            availableMinor: Math.max(0, balanceMinor - reservedMinor),
            active: true,
            isDefault,
            purpose: existing?.purpose ?? (/m-?pesa/i.test(bankName) ? "MPESA" : "SPENDING"),
            accountType: /m-?pesa/i.test(bankName) ? "MOBILE" : existing?.accountType ?? "CURRENT",
            fulizaEnabled: fulizaOn,
            fulizaOutstandingMinor: fulizaOn ? Math.round(Number(fulizaOut.replace(/,/g, "") || "0") * 100) || 0 : 0,
            fulizaLimitMinor: fulizaOn ? Math.round(Number(fulizaLimit.replace(/,/g, "") || "0") * 100) || 0 : 0,
          });
          close();
        }}
      >
        Save account
      </PrimaryButton>
    </div>
  );
}

function InvestmentForm() {
  const saveInvestment = useWaterfall((s) => s.saveInvestment);
  const close = useUi((s) => s.closeSheet);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [cost, setCost] = useState("");
  const [apr, setApr] = useState("10");
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name" value={name} onChange={setName} placeholder="CIC Money Market" />
      <Field label="Current value" value={value} onChange={setValue} inputMode="decimal" />
      <Field label="Cost basis" value={cost} onChange={setCost} inputMode="decimal" />
      <Field label="APR %" value={apr} onChange={setApr} inputMode="decimal" />
      <PrimaryButton
        className="w-full"
        onClick={() => {
          if (!name || !value) return;
          saveInvestment({
            name,
            kind: "MMF",
            valueMinor: Math.round(Number(value.replace(/,/g, "")) * 100) || 0,
            costMinor: Math.round(Number((cost || value).replace(/,/g, "")) * 100) || 0,
            apr: Number(apr) / 100 || 0,
            currencyCode: "KES",
            note: null,
          });
          close();
        }}
      >
        Save holding
      </PrimaryButton>
    </div>
  );
}

function ReceiptView() {
  const plan = useWaterfall((s) => s.lastPlan);
  const source = useWaterfall((s) => s.events[0]?.sourceLabel ?? s.prefs.lastIncomeLabel ?? "Income");
  const explanations = useWaterfall((s) => s.lastDecisionNotes);
  const close = useUi((s) => s.closeSheet);
  if (!plan) return <Meta>No allocation yet.</Meta>;
  const lines = [...plan.itemLines, ...(plan.bankLine ? [plan.bankLine] : [])].filter((line) => line.amountMinor > 0);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="receipt-paper w-full max-w-[310px] px-5 py-6 text-[#171717]">
        <div className="text-center font-mono">
          <p className="text-[15px] font-black tracking-[0.22em]">WATERFALL</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em]">Allocation receipt</p>
          <p className="mt-3 border-y border-dashed border-black/30 py-2 text-[9px] font-semibold uppercase">{source} · {todayIso()}</p>
        </div>
        <div className="mt-4 flex items-baseline justify-between font-mono text-[11px] font-bold"><span>TOTAL IN</span><span>{formatMoney(plan.incomeMinor)}</span></div>
        <div className="my-3 border-t border-dashed border-black/30" />
        <div className="space-y-2 font-mono text-[10px]">
          {lines.map((line, i) => <div key={`${line.label}-${i}`} className="flex items-start justify-between gap-3"><span className="max-w-[68%]">{line.label}</span><span className="shrink-0 font-bold">{formatMoney(line.amountMinor)}</span></div>)}
        </div>
        <div className="my-3 border-t border-dashed border-black/30" />
        <div className="space-y-1 font-mono text-[9px] leading-relaxed">
          {plan.notes.slice(0, 3).map((note) => <p key={note}>• {note}</p>)}
        </div>
        <p className="mt-5 text-center font-mono text-[8px] font-bold uppercase tracking-[0.14em]">Money allocated · ledger updated</p>
      </div>
      <div className="flex w-full max-w-[310px] gap-2">
        <GhostButton className="flex-1" onClick={() => downloadReceipt(plan, source, explanations)}>Download PDF</GhostButton>
        <PrimaryButton className="flex-1" onClick={close}>Done</PrimaryButton>
      </div>
    </div>
  );
}

function ItemDetail() {
  const id = useUi((s) => s.sheetItemId);
  const item = useWaterfall((s) => s.items.find((i) => i.id === id));
  const saveItem = useWaterfall((s) => s.saveItem);
  const deleteItem = useWaterfall((s) => s.deleteItem);
  const close = useUi((s) => s.closeSheet);
  const [label, setLabel] = useState(item?.label ?? "");
  const [target, setTarget] = useState(item ? String(Math.round(item.targetMinor / 100)) : "");
  const [importance, setImportance] = useState(item?.importance ?? (item?.bucket === "GOAL" ? "GOAL" : item?.bucket === "WANT" ? "FLEXIBLE" : "ESSENTIAL"));
  const [freq, setFreq] = useState<FrequencyCode>(
    inferFrequencyCode(item?.recurring ?? true, item?.frequencyMonths ?? 1, item?.frequencyCode),
  );
  const [customEvery, setCustomEvery] = useState(String(item?.customEvery ?? 17));
  const [customUnit, setCustomUnit] = useState<CustomUnit>(item?.customUnit ?? "days");
  const [dueDay, setDueDay] = useState(item?.dueDateIso ? String(Number(item.dueDateIso.slice(8, 10)) || 1) : "1");

  if (!item) return <Meta>Missing item.</Meta>;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Name" value={label} onChange={setLabel} />
      <Field label="How much?" value={target} onChange={setTarget} inputMode="decimal" placeholder="25000" />
      <div>
        <p className="mb-2 text-[12px] font-medium text-fg-muted">How important?</p>
        <div className="flex flex-wrap gap-2">
          {(["ESSENTIAL", "IMPORTANT", "FLEXIBLE", "GOAL"] as const).map((k) => (
            <Pill key={k} selected={importance === k} onClick={() => setImportance(k)}>
              {k === "ESSENTIAL" ? "Essential" : k === "IMPORTANT" ? "Important" : k === "FLEXIBLE" ? "Flexible" : "Goal"}
            </Pill>
          ))}
        </div>
      </div>
      <FrequencyField
        freq={freq}
        onFreq={setFreq}
        customEvery={customEvery}
        onCustomEvery={setCustomEvery}
        customUnit={customUnit}
        onCustomUnit={setCustomUnit}
      />
      {freq !== "ONCE" && freq !== "DAILY" ? (
        <div>
          <p className="mb-2 text-[12px] font-medium text-fg-muted">Due day</p>
          <div className="flex flex-wrap gap-2">
            {["1", "5", "10", "15", "20", "25"].map((d) => (
              <Pill key={d} selected={dueDay === d} onClick={() => setDueDay(d)}>
                {d}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}
      <PrimaryButton
        className="w-full"
        onClick={() => {
          if (!label || !target) return;
          const kind = importance;
          const months = monthsForFrequency(freq, Number(customEvery) || 1, customUnit);
          const recurring = freq !== "ONCE";
          const today = new Date();
          const due = new Date(today.getFullYear(), today.getMonth(), Number(dueDay) || 1);
          if (due < today) due.setMonth(due.getMonth() + 1);
          saveItem({
            id: item.id,
            bucket: bucketForImportance(kind),
            label: label.trim(),
            targetMinor: Math.round(Number(target.replace(/,/g, "")) * 100) || 0,
            currentMinor: item.currentMinor,
            currencyCode: item.currencyCode,
            dueDateIso: recurring && freq !== "DAILY" ? due.toISOString().slice(0, 10) : item.dueDateIso,
            priority: kind === "ESSENTIAL" ? 1 : kind === "IMPORTANT" ? 2 : 4,
            recurring,
            frequencyMonths: months,
            frequencyCode: freq,
            customEvery: freq === "CUSTOM" ? Number(customEvery) || 1 : undefined,
            customUnit: freq === "CUSTOM" ? customUnit : undefined,
            active: true,
            note: item.note,
            category: item.category,
            periodKey: item.periodKey,
            importance: kind,
          });
          close();
        }}
      >
        Save changes
      </PrimaryButton>
      <GhostButton
        className="w-full text-danger"
        onClick={() => {
          deleteItem(item.id);
          close();
        }}
      >
        Delete
      </GhostButton>
    </div>
  );
}

export function useResolvedTheme() {
  const mode = useWaterfall((s) => s.profile.themeMode);
  return useMemo(() => {
    if (mode === "DARK") return true;
    if (mode === "LIGHT") return false;
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [mode]);
}

function FrequencyField({
  freq,
  onFreq,
  customEvery,
  onCustomEvery,
  customUnit,
  onCustomUnit,
}: {
  freq: FrequencyCode;
  onFreq: (v: FrequencyCode) => void;
  customEvery: string;
  onCustomEvery: (v: string) => void;
  customUnit: CustomUnit;
  onCustomUnit: (v: CustomUnit) => void;
}) {
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-fg-muted">Frequency</span>
        <select
          value={freq}
          onChange={(e) => onFreq(e.target.value as FrequencyCode)}
          className="h-12 w-full appearance-none rounded-[14px] border border-border bg-bg-subtle/70 px-4 text-[15px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-ring/40"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {freq === "CUSTOM" ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="shrink-0 text-[13px] text-fg-muted">Repeat every</span>
          <input
            value={customEvery}
            onChange={(e) => onCustomEvery(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            className="h-11 w-16 rounded-[14px] border border-border bg-bg-subtle/70 px-3 text-center text-[15px] outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["days", "weeks", "months"] as const).map((u) => (
              <Pill key={u} selected={customUnit === u} onClick={() => onCustomUnit(u)}>
                {u}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
