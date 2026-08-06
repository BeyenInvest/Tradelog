import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import nl from "./locales/nl.json";
import en from "./locales/en.json";

const STORAGE_KEY = "lang";

export const SUPPORTED_LANGS = ["nl", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

function isLang(v: string | null): v is Lang {
  return v === "nl" || v === "en";
}

/**
 * A stored choice always wins. Otherwise Dutch browsers keep Dutch (the existing
 * users) and everyone else defaults to English — the sensible default as the app
 * goes international, so a non-Dutch tester lands in English without hunting for a
 * toggle first.
 */
function getInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLang(stored)) return stored;
  return navigator.language?.toLowerCase().startsWith("nl") ? "nl" : "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    nl: { translation: nl },
    en: { translation: en },
  },
  lng: getInitialLang(),
  fallbackLng: "nl", // a key missing in the active language falls back to Dutch (its source language) during the migration
  interpolation: { escapeValue: false }, // React already escapes
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language;

export default i18n;
