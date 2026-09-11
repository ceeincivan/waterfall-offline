import { EmptyState, GlassCard, Meta, Money, ProgressBar, SectionLabel } from "@/components/waterfall/primitives";
import { PrimaryAdd } from "@/components/waterfall/budget";
import { emptyCopy, goalCopy } from "@/lib/waterfall/intelligence";
import { remainingOf } from "@/lib/waterfall/money";
import { useUi, useWaterfall } from "@/lib/waterfall/store";

export function GoalsScreen() {
  const items = useWaterfall((s) => s.items.filter((i) => i.bucket === "GOAL"));
  const openSheet = useUi((s) => s.openSheet);
  const copy = emptyCopy("goals");
  const active = items.filter((i) => i.active);

  return (
    <div className="stagger flex flex-col gap-4 pb-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold tracking-tight">Goals</h1>
        <Meta>Saved, target, remaining, and when you'll get there. Nothing left implied.</Meta>
      </div>
      <PrimaryAdd onClick={() => openSheet("goal")} label="Add a goal" />
      {active.length === 0 ? (
        <EmptyState
          title={copy.title}
          body={copy.body}
          action={
            <button type="button" className="text-sm font-medium text-accent" onClick={() => openSheet("goal")}>
              Create Japan Trip, or anything else
            </button>
          }
        />
      ) : (
        active
          .slice()
          .sort((a, b) => remainingOf(a) - remainingOf(b))
          .map((goal) => {
            const g = goalCopy(goal);
            return (
              <GlassCard key={goal.id} onClick={() => openSheet("item-detail", goal.id)}>
                <p className="font-display text-[18px] font-semibold">{goal.label}</p>
                {goal.note ? <Meta className="mt-0.5">{goal.note}</Meta> : null}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Stat label="Saved" minor={goal.currentMinor} />
                  <Stat label="Target" minor={goal.targetMinor} />
                  <Stat label="Remaining" minor={g.remaining} />
                </div>
                <ProgressBar className="mt-3" value={g.pct / 100} />
                <div className="mt-2 flex justify-between text-[13px]">
                  <span className="font-medium text-accent">{g.pct}% complete</span>
                  <span className="text-fg-muted">{g.estimate}</span>
                </div>
              </GlassCard>
            );
          })
      )}
    </div>
  );
}

function Stat({ label, minor }: { label: string; minor: number }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <Money minor={minor} className="mt-0.5 block text-[14px] font-semibold" />
    </div>
  );
}

export function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="font-display text-[32px] font-semibold tracking-tight">{title}</h1>
      <Meta>{subtitle}</Meta>
    </div>
  );
}
