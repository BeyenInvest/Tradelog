import { Link } from "react-router-dom";
import { BullBearLogo } from "@/components/ui/BullBearLogo";

/**
 * Concept-tekst — NOT reviewed by a lawyer. Must be replaced/confirmed by real
 * GDPR review before public launch (the app handles trading/financial
 * journal data and will have EU users). Facts baked in below, confirmed by
 * the owner 2026-08-01: Belgium-based hobby project (no legal entity yet),
 * all hosting in the EU, no analytics/tracking cookies in the app. A
 * self-service delete button exists in code (DeleteAccountModal +
 * useAuth.deleteAccount + supabase/migrations/0006_delete_own_account.sql)
 * but is deliberately not wired into the Sidebar yet (owner call
 * 2026-08-01: too exposed without a proper profile/settings page around
 * it), so this page frames deletion as "op verzoek" rather than
 * self-service until that button is re-surfaced. The in-page notice below
 * says the same to visitors until this is replaced with reviewed copy.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-bg font-body py-12 px-4">
      <div className="w-full max-w-2xl rounded-xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-2 mb-6">
          <BullBearLogo size={22} className="text-gold" />
          <span className="font-display text-2xl italic text-ink">Beyen Invest</span>
        </div>

        <h1 className="font-display text-2xl italic text-ink mb-1">Privacybeleid</h1>
        <p className="text-xs text-loss mb-6">
          Concept — deze tekst is nog niet juridisch nagekeken en dient uitsluitend als tijdelijke plaatshouder.
        </p>

        <div className="flex flex-col gap-4 text-sm text-muted">
          <section>
            <h2 className="text-ink font-medium mb-1">1. Wie verwerkt je gegevens</h2>
            <p>
              Beyen Invest wordt op dit moment als privéproject beheerd door een natuurlijke persoon, gevestigd in
              België. Dit beleid wordt bijgewerkt met definitieve bedrijfsgegevens zodra dat verandert.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">2. Welke gegevens verzamelen we</h2>
            <p>
              Je e-mailadres (voor je account) en de trading-gegevens die je zelf invoert: trades, reviews,
              backtestprojecten en accountnotities. We plaatsen geen tracking- of analytics-cookies — enkel de
              technisch noodzakelijke sessie van Supabase Authenticatie om je ingelogd te houden.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">3. Grondslag en doel</h2>
            <p>
              We verwerken je gegevens om de overeenkomst met jou uit te voeren (art. 6.1.b AVG): je journal tonen,
              berekenen en bewaren, uitsluitend voor jouw eigen gebruik. Bij registratie verifiëren we je met een
              CAPTCHA (Cloudflare Turnstile) op basis van ons gerechtvaardigd belang (art. 6.1.f AVG) om misbruik van
              het registratieformulier tegen te gaan.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">4. Bewaartermijn</h2>
            <p>
              Zolang je account actief is. Je kunt op elk moment vragen om je account en alle bijbehorende gegevens
              te laten verwijderen — dit is onomkeerbaar.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">5. Verwerkers</h2>
            <p>
              Gegevens worden gehost bij Supabase (database/authenticatie) en Vercel (hosting), beide in een
              EU-regio, en Cloudflare (Turnstile, CAPTCHA bij registratie) — allen treden op als verwerker namens
              Beyen Invest. Er worden geen gegevens verkocht of gedeeld met derden voor marketingdoeleinden.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">6. Jouw rechten</h2>
            <p>
              Je hebt recht op inzage, correctie, verwijdering, beperking van de verwerking, overdraagbaarheid van je
              gegevens en bezwaar. Neem hiervoor contact op via{" "}
              <span className="text-loss">[contactadres — wordt toegevoegd zodra een vaste domeinnaam is gekozen]</span>.
              Je hebt ook het recht om een klacht in te dienen bij de Belgische Gegevensbeschermingsautoriteit (GBA,
              gegevensbeschermingsautoriteit.be).
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">7. Beveiliging</h2>
            <p>
              Toegang tot je gegevens is beperkt tot jouw account via database-niveau toegangscontrole (Row Level
              Security) — geen andere gebruiker kan jouw gegevens inzien.
            </p>
          </section>
        </div>

        <Link to="/signup" className="text-xs text-gold hover:underline mt-6 inline-block">
          &larr; Terug naar registreren
        </Link>
      </div>
    </div>
  );
}
