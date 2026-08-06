# Beyen Invest

Trading- en backtesting-journal (React + Supabase), gebouwd richting een self-serve multi-tenant app. De domeinregels en niet-vanzelfsprekende conventies staan in [`CLAUDE.md`](CLAUDE.md); de rekenregels leven als pure functies in [`src/lib/stats/`](src/lib/stats).

## 1. Vereisten

- Node.js 20+ en npm
- Een Supabase-project (gratis tier volstaat om te starten)
- Een Cloudflare-account (gratis) voor Turnstile, als je publieke registratie wilt aanzetten

## 2. Supabase opzetten

1. Maak een nieuw project aan op [supabase.com](https://supabase.com).
2. Open **SQL Editor** in het Supabase dashboard, plak de volledige inhoud van [`supabase/schema.sql`](supabase/schema.sql) en voer uit. Dit maakt alle enums, tabellen, indexes, triggers, de `profiles`-tabel (met auto-provisioning trigger op nieuwe signups) en RLS-policies aan.
3. Ga naar **Project Settings → API** en noteer:
   - **Project URL**
   - **anon public key**

Registratie via de app-UI (`/signup`) staat pas echt open voor het publiek nadat je onderstaande stappen 6/7 hebt doorlopen — tot die tijd kun je testaccounts nog steeds handmatig aanmaken via **Authentication → Users → Add user** (er verschijnt dan automatisch een bijpassende rij in `profiles`, dankzij de trigger).

## 3. Lokale setup

```bash
npm install
cp .env.local.example .env.local
```

Vul in `.env.local` de waarden uit stap 2 in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
VITE_TURNSTILE_SITE_KEY=xxxx   # optioneel lokaal — zonder deze key wordt de captcha-widget gewoon overgeslagen
VITE_SENTRY_DSN=xxxx           # optioneel — zonder DSN blijft error monitoring volledig uit (Sentry wordt niet geladen)
```

Error monitoring (Sentry) is opt-in: vul `VITE_SENTRY_DSN` (uit je Sentry-project) in de env-variabelen van je Vercel-project in om het aan te zetten. Zonder DSN wordt de Sentry-SDK niet eens geladen en verlaat er niets de app — errors gaan dan alleen naar de browserconsole. Het is bewust errors-only, zonder PII (geen IP/cookies).

## 4. Draaien

```bash
npm run dev       # dev server
npm run test      # vitest — rekenregels in src/lib/stats
npm run build     # productie build
```

## 5. Publieke registratie aanzetten (eenmalig, per omgeving)

Registratie staat by default nog uit op het Supabase-project (bewust, om misbruik te voorkomen zolang de flow niet volledig getest is). Volgorde om 'm aan te zetten:

1. Registreer een gratis Turnstile-site bij Cloudflare → noteer de **site key** en **secret key**.
2. Zet `VITE_TURNSTILE_SITE_KEY` (de site key) in de env-variabelen van je Vercel-project.
3. Supabase dashboard → **Authentication → Attack Protection**: zet CAPTCHA-bescherming aan, provider Turnstile, plak de **secret key**.
4. Supabase dashboard → **Authentication → URL Configuration**: Site URL = je productie-URL (`https://beyen.app`), en voeg `/login` en `/reset-password` toe aan de Redirect URLs.
5. Supabase dashboard → **Authentication → Sign In / Providers**: zet **"Allow new users to sign up"** aan.
6. Loop de verificatiestappen in het interne bouwplan door (signup → e-mailbevestiging → login → wachtwoord vergeten → reset → login) op de productieomgeving voor je dit aankondigt.

Zolang bovenstaande niet is doorlopen, faalt `/signup` gewoon met een Supabase-foutmelding — dat is verwacht gedrag, geen bug.

## 6. Structuur

- `src/lib/stats/` — alle rekenregels (streaks, drawdown, expectancy, per-dimensie uitsplitsingen, TPFS) als pure, herbruikbare functies. Elke view leest hieruit, niets wordt dubbel berekend.
- `src/lib/constants.ts` — vaste lijsten (pairs, fases, fase-kenmerken-config). Voor nu identiek voor elke gebruiker; nog niet per-gebruiker instelbaar.
- `supabase/schema.sql` — volledige DB-schema, RLS scoped per gebruiker (`user_id = auth.uid()`), inclusief `profiles` + auto-provisioning.
- `supabase/migrations/` — incrementele wijzigingen op een bestaand project, in volgorde uit te voeren.
- `src/pages/` — Journal, Backtesting, Reviews, Accounts, plus de auth-flow: Login, Signup, ForgotPassword, ResetPassword, Terms, Privacy.

**Let op:** de tekst op `/terms` en `/privacy` is placeholder-tekst, nog niet juridisch nagekeken. Vervang dit door echte, gecontroleerde voorwaarden voor je publiek launcht.

## 7. Buiten scope (bewust nog niet gebouwd)

- Per-gebruiker instelbare trading-methodologie (iedereen krijgt nog steeds dezelfde vaste "4 fasen"-strategie en vaste lijsten). Alleen het tónen van fasen is nu per gebruiker uit te zetten via `/settings` (`profiles.hide_fase`).
- Betaling/abonnementen (Stripe) — de `profiles.plan`-kolom (default `'free'`) is de enige voorbereiding hierop.
- Migratie vanuit de oude Google Sheets, combinatie-analyse van 2+ criteria, MAE/MFE-tracking, discipline/executie-tracking, live broker-koppeling.
