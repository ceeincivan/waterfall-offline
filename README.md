# Waterfall

Offline-first personal finance app designed around Kenyan financial reality (KES, M-PESA, Fuliza).

## Product

- **Safe to Spend** as the home anchor
- **Financial Radar** — liquid cash, protected money, debt pressure, cash floor, next income
- Fuliza-aware planning (tiered model, 30-day maintenance projection)
- Onboarding that creates live income, needs, reserve, and debt state
- Local-only ledger (Zustand + localStorage) — no account server required at runtime

## Offline model

Dependencies install at **build time** and are bundled into the app. After that the product runs without network access.

## Stack

- React 19 + Vite + TanStack Router/Start
- Zustand (persisted state)
- Tailwind CSS 4
- TypeScript

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build
npm test
npm run typecheck
```

## License

Private / use as you wish for this project.
