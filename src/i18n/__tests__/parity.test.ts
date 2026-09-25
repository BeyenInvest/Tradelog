// G1 (deep review 2026-09-17): i18n-sleutelpariteit. De EN-migratie is af;
// vanaf nu is élke sleutel die maar in één taal bestaat een regressie — de
// andere taal valt dan stil terug op NL (fallbackLng) en dat valt in productie
// pas op als een EN-gebruiker het meldt. Deze test maakt het een CI-fout.
import { describe, expect, it } from "vitest";
import nl from "../locales/nl.json";
import en from "../locales/en.json";
// De zod-schema's dragen hun foutmeldingen als i18n-sleutels ("tradeForm.…",
// "auth.…") die pas at render met t() opgelost worden — een typefout daar is
// onzichtbaar voor tsc. De bron als tekst inlezen en de sleutels eruit vissen.
import validationSource from "../../lib/validation.ts?raw";

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

const nlKeys = new Set(flatten(nl));
const enKeys = new Set(flatten(en));

describe("i18n-pariteit nl ≡ en", () => {
  it("elke nl-sleutel bestaat in en", () => {
    expect([...nlKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("elke en-sleutel bestaat in nl", () => {
    expect([...enKeys].filter((k) => !nlKeys.has(k))).toEqual([]);
  });

  it("alle message-sleutels uit validation.ts bestaan in beide talen", () => {
    const used = [...validationSource.matchAll(/"((?:tradeForm|auth)\.[A-Za-z0-9]+)"/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0); // de regex hoort het schema echt te zien
    expect(used.filter((k) => !nlKeys.has(k))).toEqual([]);
    expect(used.filter((k) => !enKeys.has(k))).toEqual([]);
  });
});
