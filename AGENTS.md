# AGENTS.md

# WATERFALL
## Product, Architecture & Offline-Native Constitution

---

## 0. THE PRODUCT

Waterfall is an **offline-first personal financial operating system** designed around Kenyan financial reality (KES, M-PESA, Fuliza).

It is not merely a budgeting app, expense tracker, receipt scanner, accounting tool, dashboard, AI chatbot, or banking app.

It is a unified financial system that helps a person understand:

- what money they have and where it is
- where it came from and where it went
- what it is committed to
- what they can **safely spend**
- what is likely to happen next
- what they should consider doing — and **why**

---

## 1. OFFLINE-NATIVE RULES

- **Runtime:** no network required. All data lives in Zustand + `localStorage`.
- **Build time:** UI dependencies may be installed/downloaded when building; the built app must run fully offline.
- **No auth / OAuth / server DB / WebRTC / preview-host bridges** in the offline product tree.
- Base currency is **KES**. Other currencies convert at entry via offline FX rates.

---

## 2. CORE MODULES

| Path | Role |
|------|------|
| `src/lib/waterfall/engine.ts` | Income allocation, health score, safe-to-spend helpers |
| `src/lib/waterfall/decision.ts` | Funding modes, outlook, pressure, Fuliza-aware decisions, Ask Waterfall |
| `src/lib/waterfall/tradeoff.ts` | Pressure-weighted split across needs / wants / goals |
| `src/lib/waterfall/fuliza.ts` | Outstanding, daily cost model, suggested payoff |
| `src/lib/waterfall/intelligence.ts` | NL parse (Swahili/English), insights, empty copy |
| `src/lib/waterfall/store.ts` | Zustand store + localStorage persistence |
| `src/lib/waterfall/seed.ts` | Demo seed + fresh onboarding state |
| `src/components/waterfall/*` | Screens, sheets, primitives, charts |

---

## 3. PRODUCT PRINCIPLES

1. **Safe to Spend** is the home anchor — not a vanity balance.
2. **Essentials before lifestyle.** Food and rent beat Fuliza payoff when both are short.
3. **Fuliza is a real liability** with modelled daily cost, not a cosmetic warning.
4. **Explain every recommendation** in plain language.
5. **Motion explains change**; it does not decorate every surface.
6. **Glass hierarchy** (quiet surfaces, strong type hierarchy) over noisy chrome.

---

## 4. DEVELOP

```bash
npm install
npm run dev
npm run build
npm test
npm run typecheck
```

---

## 5. FULL DESIGN CONSTITUTION

The long-form product/UX/design constitution (full AGENTS.md from the overhaul) lives in the project archive (`waterfall-offline-complete.zip`). This file is the operational summary for the offline-native repo.
