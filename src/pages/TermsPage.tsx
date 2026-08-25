import { Link } from "react-router-dom";
import { LogoMark, Wordmark } from "@/components/ui/Logo";

/**
 * Algemene voorwaarden — een volledig uitgeschreven eerste versie, opgesteld op de
 * feiten van het project zelf (niet door een jurist nagekeken). Bevestigde feiten
 * (owner 2026-08-01): aangeboden door een natuurlijke persoon in België, nog geen
 * geregistreerde onderneming, Belgisch recht, minimumleeftijd 16, alle hosting in
 * de EU, geen betaalde plannen tot billing bestaat. Contact = SUPPORT_EMAIL
 * (info@beyen.app). Aanbevolen: laat deze tekst juridisch nakijken zodra er geld
 * binnenkomt (Stripe/abonnementen) — dan gelden extra consumentenregels.
 *
 * Blijf in sync met PrivacyPage.tsx (verwerkers, bewaartermijn, contact).
 */
const LAST_UPDATED = "25 augustus 2026";
const CONTACT_EMAIL = "info@beyen.app";

export default function TermsPage() {
  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-bg font-body py-12 px-4">
      <div className="w-full max-w-2xl rounded-xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-2 mb-6">
          <LogoMark size={30} className="text-gold" />
          <span className="font-display text-3xl italic text-ink"><Wordmark /></span>
        </div>

        <h1 className="font-display text-2xl italic text-ink mb-1">Algemene Voorwaarden</h1>
        <p className="text-xs text-muted mb-6">Laatst bijgewerkt: {LAST_UPDATED}</p>

        <div className="flex flex-col gap-4 text-sm text-muted">
          <section>
            <h2 className="text-ink font-medium mb-1">1. Wie we zijn</h2>
            <p>
              Beyen (hierna "Beyen", "wij" of "ons") wordt aangeboden door een natuurlijke persoon, gevestigd in
              België. Beyen is op dit moment nog geen geregistreerde onderneming; deze voorwaarden worden bijgewerkt
              met de definitieve bedrijfs- en contactgegevens zodra dat verandert. Je kunt ons bereiken via{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">{CONTACT_EMAIL}</a>. Door een
              account aan te maken of Beyen te gebruiken, ga je akkoord met deze voorwaarden.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">2. De dienst</h2>
            <p>
              Beyen is een persoonlijk trading- en backtesting-journal waarmee je je eigen trades, reviews,
              backtestprojecten en statistieken bijhoudt en analyseert. De app toont, berekent en bewaart uitsluitend
              de gegevens die je zelf invoert of importeert.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">3. Geen financieel advies</h2>
            <p>
              Beyen is een administratie- en analysehulpmiddel — géén beleggings-, financieel, fiscaal of
              handelsadvies, en geen vermogensbeheerder, broker of aanbieder van signalen. De weergegeven cijfers,
              grafieken en statistieken zijn enkel een weergave van je eigen ingevoerde gegevens. Resultaten uit het
              verleden bieden geen enkele garantie voor de toekomst. Elke trading- of investeringsbeslissing die je
              neemt, blijft volledig je eigen verantwoordelijkheid en risico. Handelen in financiële instrumenten
              brengt risico op verlies met zich mee.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">4. Registratie en account</h2>
            <p>
              Je moet minstens 16 jaar oud zijn om een account aan te maken. Je verstrekt correcte gegevens, houdt je
              inloggegevens geheim en bent verantwoordelijk voor alle activiteit onder je account. Eén account is
              bedoeld voor één persoon; deel je inloggegevens niet. Laat het ons weten als je vermoedt dat je account
              onrechtmatig wordt gebruikt.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">5. Aanvaardbaar gebruik</h2>
            <p>Bij het gebruik van Beyen doe je het volgende niet:</p>
            <ul className="list-disc pl-5 mt-1 flex flex-col gap-1">
              <li>de dienst gebruiken voor onwettige doeleinden of in strijd met deze voorwaarden;</li>
              <li>de dienst, andere gebruikers of onze infrastructuur schaden, overbelasten of proberen te omzeilen;</li>
              <li>ongeautoriseerd toegang zoeken tot gegevens van andere gebruikers of tot delen van het systeem;</li>
              <li>de dienst geautomatiseerd uitlezen (scrapen) of doorverkopen zonder onze toestemming;</li>
              <li>inhoud uploaden waarvoor je niet de nodige rechten hebt, of die onwettig is.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">6. Jouw gegevens en inhoud</h2>
            <p>
              De trades, reviews, notities, screenshots en andere inhoud die je invoert of importeert, blijven van
              jou. Je verleent ons enkel het technische recht om die inhoud op te slaan en te verwerken voor zover
              nodig om de dienst aan jou te leveren (je journal tonen, berekenen en bewaren). Je bent zelf
              verantwoordelijk voor de juistheid en de rechtmatigheid van wat je invoert of uploadt — waaronder
              geïmporteerde brokerbestanden en screenshots. Zie ons{" "}
              <Link to="/privacy" className="text-gold hover:underline">privacybeleid</Link> voor hoe we met je
              gegevens omgaan en hoe je je account kunt laten verwijderen.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">7. Deel-links</h2>
            <p>
              Beyen laat je optioneel een deel-link aanmaken waarmee je een journal of review kunt tonen aan anderen.
              Iedereen die over zo'n link beschikt, kan de gedeelde gegevens bekijken zonder in te loggen, tot je de
              link weer intrekt. Je bepaalt zelf of en wat je deelt en bent verantwoordelijk voor het delen van de
              link. Deel geen gegevens die je vertrouwelijk wilt houden.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">8. Beschikbaarheid</h2>
            <p>
              De dienst wordt aangeboden "zoals ze is" en "zoals beschikbaar", zonder garantie op ononderbroken of
              foutloze werking. Beyen is nog in ontwikkeling; functies kunnen wijzigen, tijdelijk onbeschikbaar zijn
              of worden stopgezet. We doen redelijke inspanningen om je gegevens veilig te bewaren, maar raden je aan
              belangrijke gegevens ook zelf te bewaren waar mogelijk.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">9. Aansprakelijkheid</h2>
            <p>
              Voor zover wettelijk toegestaan zijn wij niet aansprakelijk voor onrechtstreekse of gevolgschade, voor
              gederfde winst, of voor schade die voortvloeit uit beslissingen — waaronder trading-beslissingen — die
              je op basis van de dienst of je eigen journal-gegevens neemt. Niets in deze voorwaarden sluit
              aansprakelijkheid uit die volgens de wet niet kan worden beperkt (zoals bij opzet of grove nalatigheid,
              of dwingende consumentenrechten).
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">10. Beëindiging</h2>
            <p>
              Je kunt je account op elk moment verwijderen via de instellingen of op eenvoudig verzoek; dat wist je
              account en de bijbehorende gegevens permanent. Wij kunnen een account opschorten of beëindigen bij
              ernstige of herhaalde schending van deze voorwaarden of bij onwettig gebruik.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">11. Betaalde diensten</h2>
            <p>
              Beyen is momenteel gratis. Wanneer betaalde abonnementen worden geïntroduceerd, worden de prijzen, de
              betaalvoorwaarden en je consumentenrechten (waaronder een eventueel herroepingsrecht) vooraf duidelijk
              gecommuniceerd en in deze voorwaarden opgenomen, vóór er een betaling plaatsvindt.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">12. Wijzigingen</h2>
            <p>
              We kunnen deze voorwaarden bijwerken. Belangrijke wijzigingen worden gecommuniceerd via de app of per
              e-mail. Het verder gebruiken van de dienst na een wijziging geldt als aanvaarding van de bijgewerkte
              voorwaarden.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">13. Toepasselijk recht</h2>
            <p>
              Op deze voorwaarden is het Belgisch recht van toepassing. Geschillen worden voorgelegd aan de bevoegde
              rechtbanken in België, onverminderd de dwingende rechten die je als consument geniet.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">14. Contact</h2>
            <p>
              Vragen over deze voorwaarden? Mail ons via{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">{CONTACT_EMAIL}</a>.
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
