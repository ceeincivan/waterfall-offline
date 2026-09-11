export type BudgetBucket = "NEED" | "WANT" | "GOAL" | "BANK";
export type AllocationLineKind = "CURRENT" | "FUTURE" | "BUFFER" | "BANK";
export type ThemeMode = "SYSTEM" | "LIGHT" | "DARK";
export type PaletteTheme = "ocean" | "rose" | "iris" | "emerald" | "amber" | "aurora" | "graphite";
export type CurrencyKind = "FIAT" | "CRYPTO" | "USER_DEFINED";
export type GoalKind = "SAVINGS" | "FIXED_DATE" | "BIRTHDAY" | "SEASONAL" | "EMERGENCY";
export type TxnKind = "income" | "expense" | "transfer";
export type InvestmentKind = "MMF" | "SACCO" | "EQUITY" | "BOND" | "OTHER";
export type FundingMode =
  | "SMART"
  | "SAFE"
  | "GROWTH"
  | "BALANCED"
  | "LIFESTYLE"
  | "GOAL_RUSH"
  | "RECOVERY"
  | "WINDFALL";

export type DestinationPurpose = "SPENDING" | "BILLS" | "SAVINGS" | "MPESA" | "CASH" | "INVESTMENT";
export type TabId = "home" | "plan" | "activity" | "more";
export type MorePage = "menu" | "accounts" | "investments" | "reports" | "settings" | "rules";
export type SheetId =
  | "income"
  | "expense"
  | "transfer"
  | "goal"
  | "budget-item"
  | "account"
  | "investment"
  | "debt"
  | "receipt"
  | "item-detail"
  | "ask"
  | "adjust"
  | "onboarding"
  | "preview"
  | "scenario"
  | null;

export interface Profile {
  displayName: string;
  birthdayIso: string | null;
  baseCurrencyCode: string;
  themeMode: ThemeMode;
  paletteTheme?: PaletteTheme;
  dependents?: string;
  tightness?: Tightness;
  neverTouch?: string[];
  payDay?: string;
  incomeFrequency?: "Monthly" | "Twice a month" | "Weekly" | "Irregular";
  householdLabel?: string;
}

export type Tightness = "comfortable" | "managing" | "stretched" | "crisis";
export type AccountType = "CURRENT" | "SAVINGS" | "MOBILE" | "CASH";

export interface BankAccount {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  nickname: string | null;
  currencyCode: string;
  balanceMinor: number;
  availableMinor: number;
  reservedMinor: number;
  active: boolean;
  isDefault: boolean;
  purpose?: DestinationPurpose;
  accountType?: AccountType;
  fulizaEnabled?: boolean;
  fulizaOutstandingMinor?: number;
  fulizaLimitMinor?: number;
  fulizaDailyFeeMinor?: number;
  fulizaRate?: number;
  lastBalanceIso?: string | null;
}

export interface BudgetItem {
  id: number;
  bucket: BudgetBucket;
  label: string;
  targetMinor: number;
  currentMinor: number;
  currencyCode: string;
  dueDateIso: string | null;
  priority: number;
  recurring: boolean;
  frequencyMonths: number;
  frequencyCode?: import("./frequency").FrequencyCode;
  customEvery?: number;
  customUnit?: import("./frequency").CustomUnit;
  active: boolean;
  note: string | null;
  createdAt: number;
  category?: string;
  periodKey?: string;
  importance?: "ESSENTIAL" | "IMPORTANT" | "FLEXIBLE" | "GOAL";
}

export interface IncomeSource {
  id: number;
  label: string;
  defaultBankId: number | null;
  allowedScopes: BudgetBucket[];
  selectedItemIds: number[];
  currencyCode: string;
  fxRateToBase: number;
  active: boolean;
}

export interface IncomeEntry {
  id: number;
  sourceId: number | null;
  sourceLabel: string;
  amountMinor: number;
  currencyCode: string;
  originalAmountMinor: number;
  originalCurrencyCode: string;
  receivedIso: string;
  fxRateToBase: number;
  note: string | null;
  createdAt: number;
}

export interface Transaction {
  id: number;
  kind: TxnKind;
  payee: string;
  category: string;
  amountMinor: number;
  currencyCode: string;
  accountId: number | null;
  itemId: number | null;
  isoDate: string;
  note: string | null;
  createdAt: number;
}

export interface AllocationLine {
  itemId: number | null;
  label: string;
  bucket: BudgetBucket;
  kind: AllocationLineKind;
  amountMinor: number;
  remainingAfterMinor: number;
  dueDateIso: string | null;
  note: string | null;
}

export interface AllocationPlan {
  incomeMinor: number;
  currencyCode: string;
  bufferMinor: number;
  itemLines: AllocationLine[];
  bankLine: AllocationLine | null;
  notes: string[];
}

export interface AllocationEvent {
  id: number;
  incomeEntryId: number;
  sourceLabel: string;
  totalIncomeMinor: number;
  bufferMinor: number;
  bankMinor: number;
  currencyCode: string;
  summary: string;
  createdAt: number;
  lines: AllocationLine[];
}

export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  rateToBase: number;
  isBase: boolean;
  kind: CurrencyKind;
  active: boolean;
}

export interface Investment {
  id: number;
  name: string;
  kind: InvestmentKind;
  valueMinor: number;
  costMinor: number;
  apr: number;
  currencyCode: string;
  note: string | null;
}

export interface Debt {
  id: number;
  name: string;
  remainingMinor: number;
  originalMinor: number;
  paymentMinor: number;
  apr: number;
  dueDateIso: string | null;
  currencyCode: string;
}

export interface Prefs {
  fundingMode: FundingMode;
  minReserveMinor: number;
  wantsCapMinor: number | null;
  onboarded: boolean;
  learnedCaps: Record<string, number>;
  lastIncomeLabel: string;
  lastIncomeMinor: number;
  protectedLabels?: string[];
}

export interface WaterfallState {
  profile: Profile;
  items: BudgetItem[];
  banks: BankAccount[];
  sources: IncomeSource[];
  incomeEntries: IncomeEntry[];
  transactions: Transaction[];
  events: AllocationEvent[];
  currencies: CurrencyDefinition[];
  investments: Investment[];
  debts: Debt[];
  lastPlan: AllocationPlan | null;
  lastDecisionNotes: string[];
  lastConfidence: string;
  lastReallocation: {
    amountMinor: number;
    drains: { itemId: number | null; label: string; bucket: BudgetBucket; takenMinor: number }[];
    uncoveredMinor: number;
    protectedLabels: string[];
    delayedGoals: string[];
    explanation: string;
  } | null;
  prefs: Prefs;
  nextId: number;
}
