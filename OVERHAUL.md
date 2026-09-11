# Waterfall — offline-first overhaul

The app is built for **offline operation at runtime**. Dependencies are installed and bundled at build time; after that the product does not need the network.

## Product
- Safe to Spend is the visual anchor of Home.
- Financial Radar: liquid cash, protected money, debt pressure, cash floor and next income.
- Floating glass dock navigation with quick-action control.
- Fuliza is balance-aware with a tiered model and 30-day maintenance projection.
- Onboarding writes live income, needs, reserve and debt into local state.
- Ledger data lives on-device (Zustand + localStorage).

## Offline model
- **Build time:** `npm install` pulls UI libraries (React, Radix, charts, forms, etc.) and they are compiled into the app.
- **Runtime:** no account server, no OAuth, no hosted APIs, no multiplayer signaling. The built app works without internet.

## Removed (online / web-shell assumptions)
- Auth / Better Auth / OAuth / gate sessions
- Hosted DB connectors (Neon) and server-only app-data tools
- Preview-host bridge and embedder origin (browser shell hosting)
- Multiplayer / WebRTC signaling
- In-app APK/source download CTAs aimed at a web distribution page
- Grok PWA / app-env host plugins and external font CDN links

## Kept
- Full client UI dependency set so the production bundle is self-contained
- Waterfall financial engine and screens
- Local persistence

## Run
```bash
npm install
npm run dev
npm run build
npm test
```
