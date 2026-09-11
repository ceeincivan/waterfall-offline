import { ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  EmptyState,
  GlassCard,
  Meta,
  Money,
  Pill,
  ProgressBar,
  SectionLabel,
} from "@/components/waterfall/primitives";
import { emptyCopy } from "@/lib/waterfall/intelligence";
import { remainingOf, titleCase } from "@/lib/waterfall/money";
import { frequencyLabel } from "@/lib/waterfall/frequency";
import type { BudgetBucket, BudgetItem } from "@/lib/waterfall/types";
import { useUi, useWaterfall } from "@/lib/waterfall/store";

const GROUPS: { bucket: BudgetBucket; title: string; subtitle: string }[] = [
  { bucket: "NEED", title: "Needs", subtitle: "Rent, food, transport, medical" },
  { bucket: "WANT", title: "Wants", subtitle: "Lifestyle and comfort" },
];

export function BudgetScreen() {
  const items = useWaterfall((s) => s.items);
  const openSheet = useUi((s) => s.openSheet);
  const [open, setOpen] = useState<Record<string, boolean>>({ NEED: true, WANT: true });
  const copy = emptyCopy("budget");

  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold tracking-tight">Budget</h1>
        <Meta>Every envelope explains itself. Expand a group to see remaining, not just a percentage.</Meta>
      </div>
      <PrimaryAdd onClick={() => openSheet("budget-item")} label="Add envelope" />
      {GROUPS.map((group) => {
        const list = items.filter((i) => i.bucket === group.bucket && i.active);
        const expanded = open[group.bucket];
        return (
          <GlassCard key={group.bucket} padded={false}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-4 text-left"
              onClick={() => setOpen((s) => ({ ...s, [group.bucket]: !expanded }))}
            >
              <div>
                <SectionLabel>{group.title}</SectionLabel>
                <Meta>{group.subtitle}</Meta>
              </div>
              <ChevronRight
                className="size-5 text-fg-subtle transition-transform duration-200"
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
              />
            </button>
            {expanded ? (
              <div className="flex flex-col gap-2 px-3 pb-3">
                {list.length === 0 ? (
                  <p className="px-1 pb-2 text-sm text-fg-muted">Nothing in this group yet.</p>
                ) : (
                  list.map((item) => <EnvelopeRow key={item.id} item={item} />)
                )}
              </div>
            ) : null}
          </GlassCard>
        );
      })}
      {items.filter((i) => i.bucket !== "GOAL").length === 0 ? (
        <EmptyState title={copy.title} body={copy.body} />
      ) : null}
    </div>
  );
}

function EnvelopeRow({ item }: { item: BudgetItem }) {
  const remaining = remainingOf(item);
  const pct = item.targetMinor > 0 ? item.currentMinor / item.targetMinor : 0;
  const openSheet = useUi((s) => s.openSheet);
  return (
    <button
      type="button"
      className="press w-full rounded-[18px] border border-border bg-bg-subtle/50 p-3 text-left"
      onClick={() => openSheet("item-detail", item.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium">{item.label}</p>
          <Meta>
            {titleCase(item.bucket)}
            {" · "}
            {frequencyLabel(item.recurring, item.frequencyMonths, item.frequencyCode, item.customEvery, item.customUnit)}
            {item.dueDateIso ? ` · due ${item.dueDateIso}` : ""}
          </Meta>
        </div>
        <p
          className={`num text-[13px] font-semibold ${
            remaining <= 0 ? "text-good" : pct < 0.4 ? "text-danger" : pct < 0.8 ? "text-warn" : "text-accent"
          }`}
        >
          {Math.round(pct * 100)}%
        </p>
      </div>
      <ProgressBar
        className="mt-2.5"
        value={pct}
        tone={remaining <= 0 ? "good" : pct < 0.4 ? "danger" : pct < 0.8 ? "warn" : "good"}
      />
      <div className="mt-2 flex justify-between text-[12px]">
        <span className="text-fg-muted">
          Funded <Money minor={item.currentMinor} className="font-semibold text-fg" />
        </span>
        <span className="text-fg-muted">
          Left{" "}
          <Money
            minor={remaining}
            className="font-semibold"
            tone={remaining <= 0 ? "good" : pct < 0.4 ? "danger" : "neutral"}
          />
        </span>
      </div>
    </button>
  );
}

export function PrimaryAdd({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex h-12 items-center justify-center rounded-[16px] border border-dashed border-border-strong text-[14px] font-medium text-fg-muted"
    >
      {label}
    </button>
  );
}

export function FilterPills({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Pill key={o.id} selected={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </Pill>
      ))}
    </div>
  );
}
