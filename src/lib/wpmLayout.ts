// Weekly-Phase-Method-detectie, gedeeld door de web-app (TechnicalSection) en het
// extensie-paneel (content/ui/fields.ts).
//
// De vroegere hard-gecodeerde WPM_TECH_FIELD_ORDER is per 2026-09-22 vervallen:
// beide oppervlakken tonen de config-velden nu in de EIGEN volgorde van het journal
// (sort_order), die de gebruiker in Instellingen sleept — WYSIWYG. `cc` blijft de
// uitzondering (Entry-grid in de web-app; machinaal afgeleid + verborgen in het
// paneel); dat regelen de callers zelf.

/** Een journal is "WPM" zodra het een `fase`-veld heeft — hetzelfde signaal als
 * de fase-analyselaag en de screenshot-labels. Los van de veld-vormnaam
 * (`field_key` in de web-app, `fieldKey` in het paneel), dus de caller geeft de
 * sleutels mee. */
export function hasFaseField(fieldKeys: readonly string[]): boolean {
  return fieldKeys.includes("fase");
}
