import { Link } from "react-router-dom";
import { BullBearLogo } from "@/components/ui/BullBearLogo";

/**
 * Concept-tekst — NOT reviewed by a lawyer. Must be replaced/confirmed by real
 * legal review before public launch (the app handles trading/financial
 * journal data and will have EU users). Facts baked in below, confirmed by
 * the owner 2026-08-01: run as an unregistered hobby project (no legal
 * entity yet), governed by Belgian law, minimum age 16, all hosting in the
 * EU, no paid plans until billing exists. The in-page notice says the same
 * to visitors until this is replaced with reviewed copy.
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
            <h2 className="text-ink font-medium mb-1">1. Wie we zijn</h2>
            <p>
              Beyen Invest wordt op dit moment als privéproject aangeboden door een natuurlijke persoon, gevestigd in
              België — nog niet als geregistreerde onderneming. Deze voorwaarden worden bijgewerkt zodra dat
              verandert, met de definitieve bedrijfs- en contactgegevens.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">2. De dienst</h2>
            <p>
              Beyen Invest is een persoonlijk trading- en backtesting-journal waarmee je je eigen trades, reviews en
              statistieken bijhoudt. De app biedt geen financieel, beleggings- of handelsadvies, is geen
              vermogensbeheerder of broker, en de weergegeven statistieken zijn uitsluitend een weergave van de
              gegevens die je zelf invoert. De dienst is momenteel gratis; wanneer betaalde abonnementen worden
              geïntroduceerd, wordt dat vooraf gecommuniceerd en in deze voorwaarden opgenomen.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">3. Wie een account mag aanmaken</h2>
            <p>
              Je moet minimaal 16 jaar oud zijn om een account aan te maken. Je bent verantwoordelijk voor het
              geheimhouden van je inloggegevens en voor alle activiteit onder je account.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">4. Jouw gegevens, jouw account</h2>
            <p>
              Je kunt op elk moment vragen om je account en alle bijbehorende gegevens permanent te laten
              verwijderen. Zie het{" "}
              <Link to="/privacy" className="text-gold hover:underline">
                privacybeleid
              </Link>{" "}
              voor hoe en welke gegevens dat betreft.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">5. Aansprakelijkheid</h2>
            <p>
              De dienst wordt aangeboden "zoals ze is", zonder garantie op ononderbroken beschikbaarheid of
              foutloze werking. Beslissingen die je op basis van je eigen journal-gegevens neemt — inclusief
              trading-beslissingen — blijven volledig je eigen verantwoordelijkheid. Niets in deze voorwaarden sluit
              aansprakelijkheid uit die niet wettelijk kan worden beperkt (zoals bij opzet of grove nalatigheid).
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">6. Wijzigingen</h2>
            <p>
              Deze voorwaarden kunnen worden bijgewerkt; belangrijke wijzigingen worden gecommuniceerd via de app of
              per e-mail.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">7. Toepasselijk recht</h2>
            <p>
              Op deze voorwaarden is Belgisch recht van toepassing. Geschillen worden voorgelegd aan de bevoegde
              rechter in België.
            </p>
          </section>
          <section>
            <h2 className="text-ink font-medium mb-1">8. Contact</h2>
            <p>
              Vragen over deze voorwaarden kun je richten aan{" "}
              <span className="text-loss">[contactadres — wordt toegevoegd zodra een vaste domeinnaam is gekozen]</span>.
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
