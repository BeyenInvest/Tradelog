import { Link } from "react-router-dom";
import { LogoLockup } from "@/components/ui/Logo";

/**
 * Privacybeleid — volledig uitgeschreven op basis van wat de app feitelijk doet
 * (niet door een jurist nagekeken). Bevestigde/afgeleide feiten: natuurlijke
 * persoon in België; alle hosting in een EU-regio; geen tracking-/analytics-
 * cookies; verwerkers = Supabase (DB/auth/opslag), Vercel (hosting), Cloudflare
 * (Turnstile-CAPTCHA bij registratie) en Sentry (foutmonitoring, alleen actief met
 * VITE_SENTRY_DSN, enkel fouten, sendDefaultPii:false — geen IP/cookies). Account
 * verwijderen kan self-service in Instellingen (DeleteAccountModal + useAuth.
 * deleteAccount, RPC 0006). Contact = info@beyen.app. Aanbevolen: juridische/GDPR-
 * review vóór de betaalde launch. Houd in sync met TermsPage.tsx.
 */
const LAST_UPDATED = "25 augustus 2026";
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
              Beyen wordt beheerd door een natuurlijke persoon, gevestigd in België (de "verwerkingsverantwoordelijke").
              Dit beleid wordt bijgewerkt met definitieve bedrijfsgegevens zodra Beyen een geregistreerde onderneming
              wordt. Contact voor alle privacyvragen:{" "}
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
                via foutmonitoring.
              </li>
            </ul>
            <p className="mt-1">
              We verkopen je gegevens niet en delen ze niet met derden voor marketingdoeleinden.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">4. Cookies en lokale opslag</h2>
            <p>
              We gebruiken geen tracking- of analytics-cookies. Om je ingelogd te houden bewaart de app een
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
            <h2 className="text-ink font-medium mb-1">10. Beveiliging</h2>
            <p>
              De toegang tot je gegevens is op databaseniveau beperkt tot je eigen account via toegangscontrole (Row
              Level Security), zodat geen enkele andere gebruiker je gegevens kan inzien. Verkeer verloopt versleuteld
              (TLS) en wachtwoorden worden gehasht opgeslagen door Supabase Authenticatie. Geen enkel systeem is
              volledig risicovrij, maar we nemen redelijke technische en organisatorische maatregelen.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">11. Minderjarigen</h2>
            <p>
              Beyen is niet bedoeld voor personen jonger dan 16 jaar. We verzamelen niet bewust gegevens van personen
              onder die leeftijd.
            </p>
          </section>

          <section>
            <h2 className="text-ink font-medium mb-1">12. Wijzigingen</h2>
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
