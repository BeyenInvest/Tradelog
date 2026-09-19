// Vaste veldvolgorde van de Weekly-Phase-Method-config binnen "Technical
// analysis" (owner 2026-09-19): één blok, géén aparte "Markt"-subkop. Weekly
// Kenmerk staat direct onder Fase (boven Weekly criteria); Nieuws nabij staat
// vlak boven de "richting mee?"-bevestigingen. `cc` staat er bewust NIET in:
// dat veld zit in de Entry-grid (web-app) resp. wordt machinaal afgeleid en
// verborgen (extensie-paneel).
//
// Dep-vrij met opzet: de web-app (TechnicalSection) én het extensie-paneel
// (content/ui/fields.ts) importeren dit als enige bron van waarheid, zodat de
// twee oppervlakken niet meer uit elkaar lopen (de drift-les van 2026-09-19:
// de app kreeg de eerdere volgorde wél, het paneel niet).
export const WPM_TECH_FIELD_ORDER = [
  "fase",
  "weekly_kenmerk",
  "weekly_criteria",
  "trade_concept",
  "entry",
  "nieuws",
  "w_confirm",
  "d_confirm",
  "h4_confirm",
  "extra_d_conf",
] as const;

/** Een journal is "WPM" zodra het een `fase`-veld heeft — hetzelfde signaal als
 * de fase-analyselaag en de screenshot-labels. Los van de veld-vormnaam
 * (`field_key` in de web-app, `fieldKey` in het paneel), dus de caller geeft de
 * sleutels mee. */
export function hasFaseField(fieldKeys: readonly string[]): boolean {
  return fieldKeys.includes("fase");
}
