import { createContext, useContext } from "react";
import pt from "./pt";
import en from "./en";
import es from "./es";
import fr from "./fr";
import de from "./de";

export type Locale = "pt" | "en" | "es" | "fr" | "de";
export type Translations = typeof pt;

const translations: Record<Locale, Translations> = { pt, en, es, fr, de };

export const localeNames: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}>({
  locale: "pt",
  setLocale: () => {},
  t: pt,
});

export function getTranslations(locale: Locale): Translations {
  return translations[locale] || pt;
}

export function useI18n() {
  return useContext(I18nContext);
}
