# Beyen Invest

Persoonlijk trading- en backtesting-journal (React + Supabase). Zie `beyen-invest-spec.md` voor de volledige productspecificatie.

## 1. Vereisten

- Node.js 20+ en npm
- Een Supabase-project (gratis tier volstaat)

## 2. Supabase opzetten

1. Maak een nieuw project aan op [supabase.com](https://supabase.com).
2. Open **SQL Editor** in het Supabase dashboard, plak de volledige inhoud van [`supabase/schema.sql`](supabase/schema.sql) en voer uit. Dit maakt alle enums, tabellen, indexes, triggers en RLS-policies aan.
3. Ga naar **Authentication → Users → Add user** en maak het enige account aan (jouw e-mailadres + wachtwoord). Er is geen signup-flow in de app — inloggen gebeurt met dit account.
4. Ga naar **Project Settings → API** en noteer:
   - **Project URL**
   - **anon public key**

## 3. Lokale setup

```bash
npm install
cp .env.local.example .env.local
```

Vul in `.env.local` de waarden uit stap 2.4 in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
```

## 4. Draaien

```bash
npm run dev       # dev server
npm run test      # vitest — rekenregels in src/lib/stats
npm run build     # productie build
```

## 5. Structuur

- `src/lib/stats/` — alle rekenregels (streaks, drawdown, expectancy, per-dimensie uitsplitsingen, TPFS) als pure, herbruikbare functies. Elke view leest hieruit, niets wordt dubbel berekend.
- `src/lib/constants.ts` — vaste lijsten (pairs, fases, fase-kenmerken-config).
- `supabase/schema.sql` — volledige DB-schema, RLS scoped op de ene gebruiker.
- `src/pages/` — Journal, Backtesting, Reviews, Accounts, Login.

## 6. Buiten scope in v1

Migratie vanuit de oude Google Sheets, missed-trades log, combinatie-analyse van 2+ criteria, MAE/MFE-tracking, discipline/executie-tracking, live broker-koppeling. Zie sectie 7-8 van de spec.
