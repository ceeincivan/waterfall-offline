import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildReceipt, convertToKes, resolveSelection } from "./engine";
import { decide } from "./decision";
import { applyPeriod } from "./tradeoff";
import { reallocateEmergency } from "./financial-state";
import { parseAmountMinor, remainingOf, todayIso } from "./money";
import { createSeed, createFresh } from "./seed";
import { availableOf as availableOfBank } from "./fuliza";
import type {
  AllocationPlan,
  BankAccount,
  BudgetBucket,
  BudgetItem,
  Debt,
  FundingMode,
  IncomeSource,
  Investment,
  MorePage,
  PaletteTheme,
  Prefs,
  Profile,
  SheetId,
  TabId,
  ThemeMode,
  WaterfallState,
} from "./types";

interface WaterfallActions {
  resetDemo: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setTheme: (mode: ThemeMode) => void;
  setPaletteTheme: (palette: PaletteTheme) => void;
  saveItem: (item: Omit<BudgetItem, "id" | "createdAt"> & { id?: number }) => number;
  deleteItem: (id: number) => void;
  saveBank: (bank: Omit<BankAccount, "id"> & { id?: number }) => number;
  deleteBank: (id: number) => void;
  saveSource: (source: Omit<IncomeSource, "id"> & { id?: number }) => number;
  deleteSource: (id: number) => void;
  saveInvestment: (inv: Omit<Investment, "id"> & { id?: number }) => number;
  deleteInvestment: (id: number) => void;
  saveDebt: (debt: Omit<Debt, "id"> & { id?: number }) => number;
  deleteDebt: (id: number) => void;
  saveCurrencyRate: (code: string, rateToBase: number) => void;
  logIncome: (input: {
    sourceId: number | null;
    sourceLabel: string;
    amountText: string;
    currencyCode: string;
    fxRate?: number;
    bankId: number | null;
    allowedScopes: BudgetBucket[];
    selectedItemIds: number[];
  }) => AllocationPlan | null;
  logExpense: (input: {
    payee: string;
    category: string;
    amountText: string;
    accountId: number | null;
    itemId: number | null;
    isoDate: string;
    note?: string;
  }) => import("./financial-state").Reallocation | null;
  ensurePeriod: () => void;
  logTransfer: (input: {
    fromId: number;
    toId: number;
    amountText: string;
    note?: string;
  }) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  previewIncome: (input: {
    sourceId: number | null;
    sourceLabel: string;
    amountText: string;
    currencyCode: string;
    fxRate?: number;
    bankId: number | null;
    mode?: FundingMode;
  }) => ReturnType<typeof decide> | null;
  rememberCap: (label: string, minor: number) => void;
  adjustLastPlan: (label: string, newMinor: number) => void;
}

export const useWaterfall = create<WaterfallState & WaterfallActions>()(
  persist(
    (set, get) => ({
      ...createSeed(),
      resetDemo: () => set({ ...createSeed(), prefs: { ...createSeed().prefs, onboarded: true } }),
      ensurePeriod: () =>
        set((s) => {
          const items = applyPeriod(s.items, todayIso());
          const changed = items.some(
            (item, i) =>
              item.currentMinor !== s.items[i]?.currentMinor ||
              item.periodKey !== s.items[i]?.periodKey ||
              item.dueDateIso !== s.items[i]?.dueDateIso,
          );
          return changed ? { items } : s;
        }),
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setTheme: (mode) => set((s) => ({ profile: { ...s.profile, themeMode: mode } })),
      setPaletteTheme: (palette) => set((s) => ({ profile: { ...s.profile, paletteTheme: palette } })),
      saveItem: (item) => {
        const s = get();
        if (item.id) {
          set({ items: s.items.map((i) => (i.id === item.id ? { ...i, ...item, id: item.id } : i)) });
          return item.id;
        }
        const id = s.nextId;
        set({
          nextId: id + 1,
          items: [
            ...s.items,
            {
              ...item,
              id,
              createdAt: Date.now(),
            },
          ],
        });
        return id;
      },
      deleteItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      saveBank: (bank) => {
        const s = get();
        const id = bank.id ?? s.nextId;
        const next = bank.id
          ? s.banks.map((b) => (b.id === bank.id ? { ...b, ...bank, id: bank.id } : b))
          : [...s.banks, { ...bank, id }];
        const normalized = bank.isDefault ? next.map((b) => ({ ...b, isDefault: b.id === id })) : next;
        set({ banks: normalized, nextId: bank.id ? s.nextId : id + 1 });
        return id;
      },
      deleteBank: (id) => set((s) => ({ banks: s.banks.filter((b) => b.id !== id) })),
      saveSource: (source) => {
        const s = get();
        const id = source.id ?? s.nextId;
        const next = source.id
          ? s.sources.map((x) => (x.id === source.id ? { ...x, ...source, id: source.id } : x))
          : [...s.sources, { ...source, id }];
        set({ sources: next, nextId: source.id ? s.nextId : id + 1 });
        return id;
      },
      deleteSource: (id) => set((s) => ({ sources: s.sources.filter((x) => x.id !== id) })),
      saveInvestment: (inv) => {
        const s = get();
        const id = inv.id ?? s.nextId;
        const next = inv.id
          ? s.investments.map((x) => (x.id === inv.id ? { ...x, ...inv, id: inv.id } : x))
          : [...s.investments, { ...inv, id }];
        set({ investments: next, nextId: inv.id ? s.nextId : id + 1 });
        return id;
      },
      deleteInvestment: (id) => set((s) => ({ investments: s.investments.filter((x) => x.id !== id) })),
      saveDebt: (debt) => {
        const s = get();
        const id = debt.id ?? s.nextId;
        const next = debt.id
          ? s.debts.map((x) => (x.id === debt.id ? { ...x, ...debt, id: debt.id } : x))
          : [...s.debts, { ...debt, id }];
        set({ debts: next, nextId: debt.id ? s.nextId : id + 1 });
        return id;
      },
      deleteDebt: (id) => set((s) => ({ debts: s.debts.filter((x) => x.id !== id) })),
      saveCurrencyRate: (code, rateToBase) =>
        set((s) => ({
          currencies: s.currencies.map((c) =>
            c.code === code ? { ...c, rateToBase: code === "KES" ? 1 : rateToBase } : c,
          ),
        })),
      logIncome: (input) => {
        const s0 = get();
        const itemsPeriod = applyPeriod(s0.items, todayIso());
        const s = { ...s0, items: itemsPeriod };
        const amountMinor = parseAmountMinor(input.amountText, input.currencyCode);
        if (amountMinor <= 0) return null;
        const source = s.sources.find((x) => x.id === input.sourceId) ?? null;
        const resolved = resolveSelection(source, {
          allowedScopes: input.allowedScopes,
          selectedItemIds: input.selectedItemIds,
          bankId: input.bankId,
          useAllActive: input.selectedItemIds.length === 0,
        });
        const converted = convertToKes(amountMinor, input.currencyCode, s.currencies, input.fxRate);
        const bank = s.banks.find((b) => b.id === resolved.bankId) ?? s.banks.find((b) => b.isDefault) ?? null;
        const decision = decide(s, {
          incomeMinor: converted.minor,
          sourceLabel: input.sourceLabel || "Income",
          bankId: bank?.id ?? null,
          bankLabel: bank ? bank.nickname || bank.bankName : undefined,
          mode: s.prefs.fundingMode,
          selectedItemIds: resolved.selectedItemIds,
        });
        const plan = decision.plan;
        const id = s.nextId;
        const summary = buildReceipt(input.sourceLabel || "Income", plan);
        const itemUpdates = new Map<number, number>();
        for (const line of plan.itemLines) {
          if (line.kind === "CURRENT" && line.itemId != null) {
            itemUpdates.set(line.itemId, (itemUpdates.get(line.itemId) ?? 0) + line.amountMinor);
          }
        }
        const items = s.items.map((item) =>
          itemUpdates.has(item.id)
            ? { ...item, currentMinor: item.currentMinor + (itemUpdates.get(item.id) ?? 0) }
            : item,
        );
        let banks = s.banks;
        if (bank) {
          banks = s.banks.map((b) =>
            b.id === bank.id
              ? {
                  ...b,
                  balanceMinor: b.balanceMinor + converted.minor,
                  availableMinor: availableOfBank(b) + converted.minor,
                }
              : b,
          );
        }
        const fulizaLine = plan.itemLines.find((l) => /fuliza/i.test(l.label));
        if (fulizaLine && fulizaLine.amountMinor > 0) {
          banks = banks.map((b) =>
            b.fulizaEnabled
              ? {
                  ...b,
                  fulizaOutstandingMinor: Math.max(0, (b.fulizaOutstandingMinor ?? 0) - fulizaLine.amountMinor),
                }
              : b,
          );
        }
        const event = {
          id: id + 1,
          incomeEntryId: id,
          sourceLabel: input.sourceLabel || "Income",
          totalIncomeMinor: converted.minor,
          bufferMinor: plan.bufferMinor,
          bankMinor: plan.bankLine?.amountMinor ?? 0,
          currencyCode: "KES",
          summary,
          createdAt: Date.now(),
          lines: [...plan.itemLines, ...(plan.bankLine ? [plan.bankLine] : [])],
        };
        set({
          nextId: id + 2,
          items,
          banks,
          lastPlan: plan,
          lastDecisionNotes: decision.explanations,
          lastConfidence: decision.confidence,
          prefs: {
            ...s.prefs,
            lastIncomeLabel: input.sourceLabel || s.prefs.lastIncomeLabel,
            lastIncomeMinor: converted.minor,
          },
          incomeEntries: [
            {
              id,
              sourceId: input.sourceId,
              sourceLabel: input.sourceLabel || "Income",
              amountMinor: converted.minor,
              currencyCode: "KES",
              originalAmountMinor: amountMinor,
              originalCurrencyCode: input.currencyCode,
              receivedIso: todayIso(),
              fxRateToBase: converted.rate,
              note: null,
              createdAt: Date.now(),
            },
            ...s.incomeEntries,
          ],
          transactions: [
            {
              id: id + 2,
              kind: "income",
              payee: input.sourceLabel || "Income",
              category: "Income",
              amountMinor: converted.minor,
              currencyCode: "KES",
              accountId: bank?.id ?? null,
              itemId: null,
              isoDate: todayIso(),
              note: null,
              createdAt: Date.now(),
            },
            ...s.transactions,
          ],
          events: [event, ...s.events],
          sources: input.sourceId
            ? s.sources.map((src) =>
                src.id === input.sourceId
                  ? {
                      ...src,
                      defaultBankId: resolved.bankId ?? src.defaultBankId,
                      allowedScopes: resolved.allowedScopes,
                      selectedItemIds: resolved.selectedItemIds,
                      currencyCode: input.currencyCode,
                    }
                  : src,
              )
            : s.sources,
        });
        set((curr) => ({ nextId: Math.max(curr.nextId, id + 3) }));
        return plan;
      },
      logExpense: (input) => {
        const s = get();
        const amountMinor = parseAmountMinor(input.amountText);
        if (amountMinor <= 0) return null;
        const id = s.nextId;
        const { items, banks, result } = reallocateEmergency(s.items, s.banks, amountMinor, input.accountId);
        set({
          nextId: id + 1,
          items,
          banks,
          lastDecisionNotes: [result.explanation],
          lastReallocation: result,
          transactions: [
            {
              id,
              kind: "expense",
              payee: input.payee,
              category: input.category,
              amountMinor,
              currencyCode: "KES",
              accountId: input.accountId,
              itemId: input.itemId,
              isoDate: input.isoDate || todayIso(),
              note: input.note ?? result.explanation,
              createdAt: Date.now(),
            },
            ...s.transactions,
          ],
        });
        return result;
      },
      logTransfer: (input) => {
        const s = get();
        const amountMinor = parseAmountMinor(input.amountText);
        if (amountMinor <= 0 || input.fromId === input.toId) return;
        const from = s.banks.find((b) => b.id === input.fromId);
        if (!from || from.balanceMinor < amountMinor) return;
        const id = s.nextId;
        set({
          nextId: id + 1,
          banks: s.banks.map((b) => {
            if (b.id === input.fromId) return { ...b, balanceMinor: b.balanceMinor - amountMinor };
            if (b.id === input.toId) return { ...b, balanceMinor: b.balanceMinor + amountMinor };
            return b;
          }),
          transactions: [
            {
              id,
              kind: "transfer",
              payee: "Transfer",
              category: "Transfer",
              amountMinor,
              currencyCode: "KES",
              accountId: input.toId,
              itemId: null,
              isoDate: todayIso(),
              note: input.note ?? null,
              createdAt: Date.now(),
            },
            ...s.transactions,
          ],
        });
      },
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      previewIncome: (input) => {
        const s0 = get();
        const s = { ...s0, items: applyPeriod(s0.items, todayIso()) };
        const amountMinor = parseAmountMinor(input.amountText, input.currencyCode);
        if (amountMinor <= 0) return null;
        const converted = convertToKes(amountMinor, input.currencyCode, s.currencies, input.fxRate);
        const bank = s.banks.find((b) => b.id === input.bankId) ?? s.banks.find((b) => b.isDefault) ?? null;
        return decide(s, {
          incomeMinor: converted.minor,
          sourceLabel: input.sourceLabel || "Income",
          bankId: bank?.id ?? null,
          bankLabel: bank ? bank.nickname || bank.bankName : undefined,
          mode: input.mode ?? s.prefs.fundingMode,
        });
      },
      rememberCap: (label, minor) =>
        set((s) => ({
          prefs: { ...s.prefs, learnedCaps: { ...s.prefs.learnedCaps, [label.toLowerCase()]: minor } },
        })),
      adjustLastPlan: (label, newMinor) => {
        const s = get();
        if (!s.lastPlan) return;
        const lines = s.lastPlan.itemLines.map((l) =>
          l.label === label ? { ...l, amountMinor: Math.max(0, newMinor), note: "Adjusted by you. Waterfall will remember." } : l,
        );
        const old = s.lastPlan.itemLines.find((l) => l.label === label);
        const delta = (old?.amountMinor ?? 0) - newMinor;
        set({
          lastPlan: { ...s.lastPlan, itemLines: lines, bufferMinor: s.lastPlan.bufferMinor + delta },
          prefs: { ...s.prefs, learnedCaps: { ...s.prefs.learnedCaps, [label.toLowerCase()]: newMinor } },
          lastDecisionNotes: [`You set ${label} to a remembered amount. Next time Waterfall will start from that.`],
        });
      },
    }),
    {
      name: "waterfall-v20-intel",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        profile: s.profile,
        items: s.items,
        banks: s.banks,
        sources: s.sources,
        incomeEntries: s.incomeEntries,
        transactions: s.transactions,
        events: s.events,
        currencies: s.currencies,
        investments: s.investments,
        debts: s.debts,
        lastPlan: s.lastPlan,
        lastDecisionNotes: s.lastDecisionNotes,
        lastConfidence: s.lastConfidence,
        lastReallocation: s.lastReallocation,
        prefs: s.prefs,
        nextId: s.nextId,
      }),
    },
  ),
);

interface UiState {
  tab: TabId;
  morePage: MorePage;
  sheet: SheetId;
  sheetItemId: number | null;
  fabOpen: boolean;
  setTab: (tab: TabId) => void;
  setMorePage: (page: MorePage) => void;
  openSheet: (sheet: SheetId, itemId?: number | null) => void;
  closeSheet: () => void;
  toggleFab: () => void;
  closeFab: () => void;
}

export const useUi = create<UiState>((set) => ({
  tab: "home",
  morePage: "menu",
  sheet: null,
  sheetItemId: null,
  fabOpen: false,
  setTab: (tab) => set({ tab, fabOpen: false, morePage: tab === "more" ? "menu" : getMoreKeep(tab) }),
  setMorePage: (morePage) => set({ morePage, tab: "more" }),
  openSheet: (sheet, itemId = null) => set({ sheet, sheetItemId: itemId ?? null, fabOpen: false }),
  closeSheet: () => set({ sheet: null, sheetItemId: null }),
  toggleFab: () => set((s) => ({ fabOpen: !s.fabOpen })),
  closeFab: () => set({ fabOpen: false }),
}));

function getMoreKeep(tab: TabId): MorePage {
  return tab === "more" ? "menu" : "menu";
}

export function liquidBalance(state: WaterfallState): number {
  return state.banks.filter((b) => b.active).reduce((s, b) => s + b.balanceMinor, 0);
}

export function monthlyPlan(state: WaterfallState) {
  const envelopes = state.items.filter((i) => i.active && (i.bucket === "NEED" || i.bucket === "WANT") && remainingOf(i) > 0);
  const target = envelopes.reduce((s, i) => s + i.targetMinor, 0);
  const current = envelopes.reduce((s, i) => s + i.currentMinor, 0);
  const remaining = envelopes.reduce((s, i) => s + remainingOf(i), 0);
  const pct = target > 0 ? remaining / target : 0;
  return { target, current, remaining, pct };
}

export function displayName(state: WaterfallState): string {
  return state.profile.displayName.trim() || "there";
}
