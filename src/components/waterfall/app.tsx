import { Home, ListTodo, MessageCircle, Plus, Receipt, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActivityScreen } from "@/components/waterfall/activity";
import { HomeScreen } from "@/components/waterfall/home";
import { HomeSkeleton } from "@/components/waterfall/loading";
import { MoreScreen } from "@/components/waterfall/more";
import { Onboarding } from "@/components/waterfall/onboarding";
import { Opening } from "@/components/waterfall/opening";
import { PlanScreen } from "@/components/waterfall/plan";
import { Sheets, useResolvedTheme } from "@/components/waterfall/sheets";
import { StatusBar } from "@/components/waterfall/primitives";
import { cn } from "@/lib/utils";
import type { TabId } from "@/lib/waterfall/types";
import { useUi, useWaterfall } from "@/lib/waterfall/store";

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "plan", label: "Plan", icon: ListTodo },
  { id: "activity", label: "Activity", icon: Receipt },
  { id: "more", label: "More", icon: Settings },
];

export function WaterfallApp() {
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(true);
  const [scrolling, setScrolling] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const tab = useUi((s) => s.tab);
  const dark = useResolvedTheme();
  const onboarded = useWaterfall((s) => s.prefs.onboarded);
  const paletteTheme = useWaterfall((s) => s.profile.paletteTheme ?? "ocean");

  useEffect(() => {
    void Promise.resolve(useWaterfall.persist.rehydrate()).finally(() => {
      useWaterfall.getState().ensurePeriod();
      setReady(true);
    });
  }, []);

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout>;
    const mainEl = mainRef.current;
    if (!mainEl) return;

    function handleScroll() {
      setScrolling(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setScrolling(false);
      }, 350);
    }

    mainEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      mainEl.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimer);
    };
  }, [ready, onboarded]);

  const paletteClass = `theme-palette-${paletteTheme}`;

  if (opening) {
    return (
      <div className={cn("studio", dark && "theme-dark-studio")}>
        <div className={cn("device opening-device", dark && "theme-dark", paletteClass)}>
          <Opening onDone={() => setOpening(false)} />
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={cn("studio", dark && "theme-dark-studio")}>
        <div className={cn("device", dark && "theme-dark", paletteClass)}>
          <StatusBar dark={dark} />
          <HomeSkeleton />
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <div className={cn("studio", dark && "theme-dark-studio")}>
        <div className={cn("device", dark && "theme-dark", paletteClass)}>
          <Onboarding />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("studio", dark && "theme-dark-studio")}>
      <div className={cn("device", dark && "theme-dark", paletteClass)}>
        <StatusBar dark={dark} />
        <main ref={mainRef} className="scroll-y relative flex-1 px-4 pb-32 pt-1">
          {tab === "home" ? <HomeScreen /> : null}
          {tab === "plan" ? <PlanScreen /> : null}
          {tab === "activity" ? <ActivityScreen /> : null}
          {tab === "more" ? <MoreScreen /> : null}
        </main>
        <GlassBottomDock scrolling={scrolling} />
        <Sheets />
      </div>
    </div>
  );
}

function GlassBottomDock({ scrolling }: { scrolling?: boolean }) {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const fabOpen = useUi((s) => s.fabOpen);
  const toggleFab = useUi((s) => s.toggleFab);
  const closeFab = useUi((s) => s.closeFab);
  const openSheet = useUi((s) => s.openSheet);
  const [tilt, setTilt] = useState({ x: 50, y: 30 });

  useEffect(() => {
    let currentX = 50;
    let currentY = 30;
    let targetX = 50;
    let targetY = 30;
    let animId: number;

    function smoothLoop() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      setTilt({ x: Math.round(currentX * 10) / 10, y: Math.round(currentY * 10) / 10 });
      animId = requestAnimationFrame(smoothLoop);
    }

    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.gamma !== null && e.beta !== null) {
        targetX = Math.min(Math.max(((e.gamma + 45) / 90) * 100, 10), 90);
        targetY = Math.min(Math.max(((e.beta + 30) / 90) * 100, 10), 90);
      }
    }

    function handlePointerMove(e: PointerEvent) {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
    }

    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
    window.addEventListener("pointermove", handlePointerMove);
    animId = requestAnimationFrame(smoothLoop);

    return () => {
      if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
        window.removeEventListener("deviceorientation", handleOrientation, true);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-4 z-30 flex flex-col items-end px-3.5 pointer-events-none transition-all duration-300 ease-out",
        scrolling && "translate-y-2 opacity-90 scale-[0.98]"
      )}
    >
      {fabOpen ? (
        <div className="pointer-events-auto mb-3 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-40">
          <FabChip label="Money in" onClick={() => { closeFab(); openSheet("income"); }} />
          <FabChip label="Expense / Out" onClick={() => { closeFab(); openSheet("expense"); }} />
          <FabChip label="Ask Waterfall" onClick={() => { closeFab(); openSheet("ask"); }} />
        </div>
      ) : null}

      <div className="pointer-events-auto flex w-full items-center justify-between gap-2.5">
        <nav
          className={cn(
            "glass-dock relative flex h-[64px] flex-1 items-center justify-around rounded-full px-2 transition-all duration-300 overflow-hidden"
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-full opacity-60 transition-opacity duration-150"
            style={{
              background: `radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 40%, transparent 80%)`,
            }}
          />

          <div className="pointer-events-none absolute inset-x-5 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/50 to-transparent" />

          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  closeFab();
                  setTab(t.id);
                }}
                className={cn(
                  "relative z-10 flex min-w-[54px] flex-col items-center gap-0.5 text-[11px] font-semibold transition-all duration-150 active:scale-90",
                  on ? "text-accent scale-105" : "text-fg-muted hover:text-fg"
                )}
              >
                <Icon className="size-[21px]" strokeWidth={on ? 2.5 : 1.8} />
                <span>{t.label}</span>
                {on ? (
                  <span className="absolute -bottom-1 size-1.5 rounded-full bg-accent shadow-[0_0_10px_currentColor]" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={toggleFab}
          className={cn(
            "relative flex size-[64px] shrink-0 items-center justify-center rounded-full text-accent-fg shadow-2xl transition-all duration-300 active:scale-90 overflow-hidden",
            "backdrop-blur-3xl backdrop-saturate-200",
            "bg-accent/90 dark:bg-accent/85",
            "border border-white/50 dark:border-white/35",
            "shadow-[0_16px_40px_rgba(0,0,0,0.25),inset_0_1.5px_2px_rgba(255,255,255,0.8)] dark:shadow-[0_18px_48px_rgba(0,0,0,0.7),inset_0_1.5px_2px_rgba(255,255,255,0.4)]"
          )}
          aria-label="Quick actions"
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-full opacity-60 transition-opacity duration-150"
            style={{
              background: `radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(255,255,255,0.65) 0%, transparent 70%)`,
            }}
          />
          <div className="pointer-events-none absolute inset-x-3 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/90 to-transparent" />
          {fabOpen ? <MessageCircle className="size-6 relative z-10" /> : <Plus className="size-7 relative z-10" />}
        </button>
      </div>
    </div>
  );
}

function FabChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press rounded-full bg-bg-elevated/90 backdrop-blur-lg px-4 py-2 text-[13px] font-semibold shadow-glass border border-white/10"
    >
      {label}
    </button>
  );
}
