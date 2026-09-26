import { Link } from "react-router-dom";
import { LogoLockup } from "@/components/ui/Logo";

/**
 * Privacybeleid — volledig uitgeschreven op basis van wat de app feitelijk doet
 * (niet door een jurist nagekeken). Bevestigde/afgeleide feiten: Chesney Beyen als
 * natuurlijke persoon in België; alle hosting in een EU-regio; geen tracking-/analytics-
 * cookies (Plausible = cookieloze, geaggregeerde bezoekersstatistiek, EU-gehost —
 * launchplan L6, 2026-09-26); verwerkers = Supabase (DB/auth/opslag), Vercel (hosting), Cloudflare
 * (Turnstile-CAPTCHA bij registratie) en Sentry (foutmonitoring, alleen actief met
 * VITE_SENTRY_DSN, enkel fouten, sendDefaultPii:false — geen IP/cookies). Account
 * verwijderen kan self-service in Instellingen (DeleteAccountModal + useAuth.
 * deleteAccount, RPC 0006). Contact = info@beyen.app. Aanbevolen: juridische/GDPR-
 * review vóór de betaalde launch. Houd in sync met TermsPage.tsx.
 *
 * ⚠️ Punt 10 (TradingView-extensie, F4b 2026-09-17) is net als de rest van deze
 * pagina NIET juridisch nagekeken. Het beschrijft wat de extensie feitelijk doet
 * (extension/: chart-adapter leest symbool/timeframe/position-tool, snapshots via
 * captureVisibleTab naar de eigen Supabase-bucket, sessie in chrome.storage via
 * een eenmalige koppelcode uit api/extension-link.ts). Dit punt moet mee in de
 * juridische review, en moet live staan vóór de eerste externe installatie uit de
 * Web Store — de Store-listing verwijst naar deze pagina als privacy-policy-URL.
 */
const LAST_UPDATED = "26 september 2026";
const PROVIDER_NAME = "Chesney Beyen";
const CONTACT_EMAIL = "info@beyen.app";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-bg font-body py-12 px-4">
      <div className="w-full max-w-2xl rounded-xl p-8 bg-surface border border-border">
        <div className="mb-6">
          <LogoLockup size={28} className="text-gold" />
        </div>

        <h1 className="font-display text-2xl italic text-ink mb-1">Privacybeleid</h1>
        <p className="text-xs text-muted mb-6">Laatst bijgewerkt: {LAST_UPDATED}</p>

        <div className="flex flex-col gap-4 text-sm text-muted">
          <section>
            <h2 className="text-ink font-medium mb-1">1. Wie verwerkt je gegevens</h2>
            <p>
              Beyen wordt beheerd door {PROVIDER_NAME}, een natuurlijke persoon gevestigd in België (de
              "verwerkingsverantwoordelijke"). Dit beleid wordt bijgewerkt met definitieve bedrijfsgegevens zodra Beyen
              een geregistreerde onderneming wordt. Contact voor alle privacyvragen:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">2. Welke gegevens we verwerken</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                <span className="text-ink">Accountgegevens:</span> je e-mailadres en wachtwoord (het wachtwoord wordt
                door Supabase Authenticatie versleuteld opgeslagen — wij zien het niet), en optioneel je weergavenaam,
                tijdzone en taalvoorkeur.
              </li>
              <li>
                <span className="text-ink">Journal-inhoud die je zelf invoert of importeert:</span> trades en hun
                kenmerken, weekly/periodieke reviews (inclusief je eigen notities), backtestprojecten, prop-account-
                gegevens en -notities, en je eigen methodiek-/veldinstellingen.
              </li>
              <li>
                <span className="text-ink">Screenshots</span> die je optioneel bij een trade uploadt (opgeslagen in
                Supabase Storage).
              </li>
              <li>
                <span className="text-ink">Deel-links</span> die je zelf aanmaakt (zie punt 9).
              </li>
              <li>
                <span className="text-ink">Technische gegevens:</span> een sessietoken om je ingelogd te houden, en —
                enkel wanneer foutmonitoring aanstaat — technische foutrapporten zonder je IP-adres of persoonlijke
                identificatie (zie punt 5).
              </li>
              <li>
                <span className="text-ink">Bezoekersstatistiek:</span> geanonimiseerde, geaggregeerde gegevens over
                het gebruik van de website (bezochte pagina's, verwijzende website, land, apparaattype) en of er een
                account werd aangemaakt — zonder cookies en zonder dat je als persoon herkenbaar bent (zie punt 4 en 5).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">3. Waarvoor en op welke grondslag</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                <span className="text-ink">Uitvoering van de overeenkomst</span> (art. 6.1.b AVG): je account beheren
                en je journal tonen, berekenen en bewaren voor jouw eigen gebruik.
              </li>
              <li>
                <span className="text-ink">Gerechtvaardigd belang</span> (art. 6.1.f AVG): misbruik van het
                registratieformulier tegengaan via een CAPTCHA, en de stabiliteit en veiligheid van de dienst bewaken
                via foutmonitoring, en via geanonimiseerde bezoekersstatistiek begrijpen hoe de website gebruikt wordt
                en welke kanalen bezoekers opleveren.
              </li>
            </ul>
            <p className="mt-1">
              We verkopen je gegevens niet en delen ze niet met derden voor marketingdoeleinden.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">4. Cookies en lokale opslag</h2>
            <p>
              We gebruiken geen tracking- of analytics-cookies. Voor bezoekersstatistiek gebruiken we Plausible
              Analytics, dat zonder cookies werkt en geen persoonsgegevens of IP-adressen bewaart. Om je ingelogd te houden bewaart de app een
              technisch noodzakelijke sessie van Supabase Authenticatie in je browser, en je taalvoorkeur lokaal. Bij
              het registreren laadt een CAPTCHA (Cloudflare Turnstile) om geautomatiseerd misbruik te weren.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">5. Verwerkers</h2>
            <p>We doen een beroep op de volgende verwerkers, die namens ons en volgens onze instructies handelen:</p>
            <ul className="list-disc pl-5 mt-1 flex flex-col gap-1">
              <li><span className="text-ink">Supabase</span> — database, authenticatie en opslag (EU-regio).</li>
              <li><span className="text-ink">Vercel</span> — hosting en levering van de webapplicatie.</li>
              <li><span className="text-ink">Cloudflare</span> — Turnstile-CAPTCHA bij registratie.</li>
              <li>
                <span className="text-ink">Plausible Analytics</span> — cookieloze, geaggregeerde bezoekersstatistiek
                (EU-bedrijf, gegevens gehost in de EU).
              </li>
              <li>
                <span className="text-ink">Sentry</span> — foutmonitoring, uitsluitend wanneer geactiveerd; enkel
                technische foutgegevens, zonder IP-adres of andere directe persoonsgegevens.
              </li>
            </ul>
            <p className="mt-1">
              Voor het verzenden van accountgerelateerde e-mails (zoals bevestiging en wachtwoordherstel) kan een
              e-mailverzenddienst worden ingezet. Er worden momenteel geen betalingen verwerkt; dit beleid wordt
              aangevuld met de betaalverwerker zodra betaalde abonnementen worden ingevoerd.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">6. Internationale doorgifte</h2>
            <p>
              Je gegevens worden in de Europese Unie gehost. Sommige verwerkers (zoals Cloudflare en Sentry) zijn
              buiten de EU gevestigd; waar daarbij gegevens buiten de Europese Economische Ruimte worden verwerkt,
              gebeurt dat onder passende waarborgen, zoals de standaardcontractbepalingen van de Europese Commissie.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">7. Bewaartermijn</h2>
            <p>
              We bewaren je gegevens zolang je account actief is. Je kunt je account op elk moment zelf verwijderen via
              Instellingen, of op verzoek via <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">{CONTACT_EMAIL}</a>.
              Verwijdering wist je account en de bijbehorende gegevens permanent en is onomkeerbaar.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">8. Jouw rechten</h2>
            <p>
              Je hebt recht op inzage, correctie, verwijdering, beperking van de verwerking, overdraagbaarheid van je
              gegevens en bezwaar. Neem hiervoor contact op via{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">{CONTACT_EMAIL}</a>. Je hebt ook
              het recht een klacht in te dienen bij de Belgische Gegevensbeschermingsautoriteit (GBA —
              gegevensbeschermingsautoriteit.be).
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">9. Deel-links</h2>
            <p>
              Als je zelf een deel-link aanmaakt, wordt de door jou geselecteerde journal- of review-inhoud
              toegankelijk voor iedereen die over die link beschikt, zonder in te loggen, tot je de link weer intrekt.
              Deel geen gegevens die je vertrouwelijk wilt houden.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">10. TradingView-extensie (beta)</h2>
            <p>
              Gebruik je onze Chrome-extensie voor TradingView, dan geldt daarvoor het volgende. De extensie is
              optioneel: ze doet niets tot je haar zelf installeert en koppelt.
            </p>
            <ul className="list-disc pl-5 mt-1 flex flex-col gap-1">
              <li>
                <span className="text-ink">Wat ze leest:</span> uitsluitend op een TradingView-chartpagina, en
                uitsluitend wat jij daar zelf hebt staan — het symbool, het timeframe en de prijzen en richting van je
                eigen position-tool (entry, stop, target), plus de bijbehorende bar-tijd. Ze leest geen koersdata, geen
                andere websites en niets buiten de chartpagina's van TradingView.
              </li>
              <li>
                <span className="text-ink">Wat ze opslaat:</span> de trade die je zelf logt en de eventuele screenshots
                die je laat maken, in jouw eigen Beyen-account — dezelfde tabellen, opslag en toegangscontrole (Row
                Level Security) als wanneer je de trade in de webapp invoert. Een screenshot wordt bijgesneden tot het
                chartgebied en pas geüpload wanneer jij daarom vraagt.
              </li>
              <li>
                <span className="text-ink">Hoe de koppeling werkt:</span> je genereert in Instellingen een eenmalige,
                kortlevende koppelcode en plakt die in de extensie. Daarmee krijgt de extensie een eigen sessie met
                exact jouw rechten. Die sessie wordt lokaal in je browser bewaard (chrome.storage), samen met je
                taalvoorkeur en een kleine technische log voor foutopsporing. In de extensie kun je op elk moment
                “Koppel los” kiezen; dan wordt die lokale sessie gewist.
              </li>
              <li>
                <span className="text-ink">Waar het naartoe gaat:</span> alleen naar Beyen (Supabase). De extensie
                stuurt niets naar TradingView, naar ons of naar derden buiten die eigen opslag, bevat geen tracking of
                advertenties, en verkoopt of deelt je gegevens niet.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">11. Beveiliging</h2>
            <p>
              De toegang tot je gegevens is op databaseniveau beperkt tot je eigen account via toegangscontrole (Row
              Level Security), zodat geen enkele andere gebruiker je gegevens kan inzien. Verkeer verloopt versleuteld
              (TLS) en wachtwoorden worden gehasht opgeslagen door Supabase Authenticatie. Geen enkel systeem is
              volledig risicovrij, maar we nemen redelijke technische en organisatorische maatregelen.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">12. Minderjarigen</h2>
            <p>
              Beyen is niet bedoeld voor personen jonger dan 16 jaar. We verzamelen niet bewust gegevens van personen
              onder die leeftijd.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">13. Wijzigingen</h2>
            <p>
              We kunnen dit beleid bijwerken. Belangrijke wijzigingen worden gecommuniceerd via de app of per e-mail;
              de datum bovenaan geeft de laatste versie aan.
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
