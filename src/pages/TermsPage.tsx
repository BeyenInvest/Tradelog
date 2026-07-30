import { Link } from "react-router-dom";
import { BullBearLogo } from "@/components/ui/BullBearLogo";

/**
 * Placeholder copy — NOT reviewed by a lawyer. Must be replaced with real,
 * reviewed terms before public launch (the app handles trading/financial
 * journal data and will have EU users, so this needs proper legal input,
 * not just AI-drafted boilerplate). The in-page notice below says the same
 * to visitors until this is replaced.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-bg font-body py-12 px-4">
      <div className="w-full max-w-2xl rounded-xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-2 mb-6">
          <BullBearLogo size={22} className="text-gold" />
          <span className="font-display text-2xl italic text-ink">Beyen Invest</span>
        </div>

        <h1 className="font-display text-2xl italic text-ink mb-1">Algemene Voorwaarden</h1>
        <p className="text-xs text-loss mb-6">
          Concept — deze tekst is nog niet juridisch nagekeken en dient uitsluitend als tijdelijke plaatshouder.
        </p>

        <div className="flex flex-col gap-4 text-sm text-muted">
          <section>
            <h2 className="text-ink font-medium mb-1">1. De dienst</h2>
            <p>
              Beyen Invest is een persoonlijk trading- en backtesting-journal waarmee je je eigen trades, reviews en
              statistieken bijhoudt. De app biedt geen financieel, beleggings- of handelsadvies en de weergegeven
              statistieken zijn uitsluitend een weergave van de gegevens die je zelf invoert.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">2. Je account</h2>
            <p>
              Je bent verantwoordelijk voor het geheimhouden van je inloggegevens en voor alle activiteit onder je
              account.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">3. Aansprakelijkheid</h2>
            <p>
              De dienst wordt aangeboden "zoals ze is". Beslissingen die je op basis van je eigen journal-gegevens
              neemt, blijven volledig je eigen verantwoordelijkheid.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">4. Wijzigingen</h2>
            <p>Deze voorwaarden kunnen worden bijgewerkt; belangrijke wijzigingen worden gecommuniceerd.</p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">5. Contact</h2>
            <p>Vragen over deze voorwaarden kun je richten aan het contactadres van Beyen Invest.</p>
          </section>
        </div>

        <Link to="/signup" className="text-xs text-gold hover:underline mt-6 inline-block">
          &larr; Terug naar registreren
        </Link>
      </div>
    </div>
  );
}
