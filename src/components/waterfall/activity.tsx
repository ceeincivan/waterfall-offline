import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { FilterPills, PrimaryAdd } from "@/components/waterfall/budget";
import { EmptyState, GlassCard, Meta, Money } from "@/components/waterfall/primitives";
import { emptyCopy } from "@/lib/waterfall/intelligence";
import { daysBetween, formatMoney, todayIso } from "@/lib/waterfall/money";
import type { TxnKind } from "@/lib/waterfall/types";
import { useUi, useWaterfall } from "@/lib/waterfall/store";

export function ActivityScreen() {
  const transactions = useWaterfall((s) => s.transactions);
  const banks = useWaterfall((s) => s.banks);
  const openSheet = useUi((s) => s.openSheet);
  const [filter, setFilter] = useState<"all" | TxnKind>("all");
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState<"date" | "context">("date");
  const copy = emptyCopy("activity");
  const today = todayIso();

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => (filter === "all" ? true : t.kind === filter))
      .filter((t) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          t.payee.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.note && t.note.toLowerCase().includes(q))
        );
      })
      .slice()
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate) || b.createdAt - a.createdAt);
  }, [transactions, filter, search]);

  const groups = useMemo(() => {
    if (groupMode === "date") {
      const map = new Map<string, typeof filtered>();
      for (const t of filtered) {
        const days = daysBetween(t.isoDate, today);
        let label = t.isoDate;
        if (days === 0) label = "Today";
        else if (days === 1) label = "Yesterday";
        else if (days <= 7) label = "This week";
        else label = "Earlier";

        const arr = map.get(label) ?? [];
        arr.push(t);
        map.set(label, arr);
      }
      return [...map.entries()];
    } else {
      const map = new Map<string, typeof filtered>();
      for (const t of filtered) {
        let label = "General";
        if (t.kind === "income") label = "Income & Salary";
        else if (/rent|housing|electricity|water|tokens|kplc|bill/i.test(t.category + t.payee)) label = "Bills & Must Pay";
        else if (/food|matatu|fare|grocery|naivas|quickmart/i.test(t.category + t.payee)) label = "Food & Transport";
        else if (t.kind === "transfer") label = "Account Transfers";

        const arr = map.get(label) ?? [];
        arr.push(t);
        map.set(label, arr);
      }
      return [...map.entries()];
    }
  }, [filtered, groupMode, today]);

  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold tracking-tight">Ledger</h1>
        <Meta>Smart contextual ledger with local classification and account tracking.</Meta>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 size-4 text-fg-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payee, category, note…"
          className="h-11 w-full rounded-2xl border border-border bg-bg-subtle/80 pl-10 pr-4 text-[14px] outline-none focus:border-accent"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <FilterPills
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { id: "all", label: "All" },
            { id: "expense", label: "Expenses" },
            { id: "income", label: "Income" },
            { id: "transfer", label: "Transfers" },
          ]}
        />
        <div className="flex rounded-full bg-bg-subtle p-0.5 shrink-0">
          <button
            type="button"
            className={`px-3 py-1 text-[11px] font-bold rounded-full ${groupMode === "date" ? "bg-bg-elevated text-fg shadow-sm" : "text-fg-muted"}`}
            onClick={() => setGroupMode("date")}
          >
            Date
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-[11px] font-bold rounded-full ${groupMode === "context" ? "bg-bg-elevated text-fg shadow-sm" : "text-fg-muted"}`}
            onClick={() => setGroupMode("context")}
          >
            Context
          </button>
        </div>
      </div>

      <PrimaryAdd onClick={() => openSheet("expense")} label="Log an expense" />

      {filtered.length === 0 ? (
        <EmptyState title={copy.title} body={copy.body} />
      ) : (
        groups.map(([header, rows]) => (
          <div key={header}>
            <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.12em] text-accent">{header}</p>
            <GlassCard padded={false}>
              {rows.map((t, i) => {
                const acc = banks.find((b) => b.id === t.accountId);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${i < rows.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-bg-subtle/80 text-accent border border-border/40">
                      {t.kind === "income" ? (
                        <ArrowDownLeft className="size-4 text-good" />
                      ) : t.kind === "transfer" ? (
                        <ArrowLeftRight className="size-4 text-accent" />
                      ) : (
                        <ArrowUpRight className="size-4 text-danger" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-bold text-fg">{t.payee}</p>
                        <span className="rounded-md bg-accent-soft/60 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          {t.category}
                        </span>
                      </div>
                      <Meta>
                        {acc ? acc.nickname || acc.bankName : "M-PESA"} · {t.isoDate}
                      </Meta>
                    </div>
                    <Money
                      minor={t.kind === "expense" ? -t.amountMinor : t.amountMinor}
                      className="text-[14px] font-bold"
                      tone={t.kind === "expense" ? "danger" : t.kind === "income" ? "good" : "neutral"}
                    />
                  </div>
                );
              })}
            </GlassCard>
          </div>
        ))
      )}
    </div>
  );
}
