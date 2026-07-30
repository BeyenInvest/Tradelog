import { Link } from "react-router-dom";
import { BullBearLogo } from "@/components/ui/BullBearLogo";

/**
 * Placeholder copy — NOT reviewed by a lawyer. Must be replaced with real,
 * GDPR-reviewed privacy terms before public launch (the app handles
 * trading/financial journal data and will have EU users). The in-page notice
 * below says the same to visitors until this is replaced.
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
            <h2 className="text-ink font-medium mb-1">1. Welke gegevens verzamelen we</h2>
            <p>
              Je e-mailadres (voor je account) en de trading-gegevens die je zelf invoert: trades, reviews,
              backtestprojecten en accountnotities.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">2. Waarom</h2>
            <p>Om de dienst te leveren: jouw journal tonen, berekenen en bewaren — uitsluitend voor jouw gebruik.</p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">3. Bewaartermijn</h2>
            <p>Zolang je account actief is. Bij verwijdering van je account worden je gegevens verwijderd.</p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">4. Verwerkers</h2>
            <p>
              Gegevens worden gehost bij Supabase (database/authenticatie) en Vercel (hosting) — beide treden op als
              verwerker namens Beyen Invest.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">5. Jouw rechten</h2>
            <p>
              Je hebt recht op inzage, correctie en verwijdering van je gegevens. Neem hiervoor contact op via het
              contactadres van Beyen Invest.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">6. Beveiliging</h2>
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
