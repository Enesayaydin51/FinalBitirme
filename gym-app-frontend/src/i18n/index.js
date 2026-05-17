import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import tr from "./locales/tr.json";

export const LANGUAGE_STORAGE_KEY = "@gym_app_language";

export const supportedLanguages = [
  { code: "tr", flag: "🇹🇷", shortLabel: "TR", labelKey: "profile.language.turkish" },
  { code: "en", flag: "🇬🇧", shortLabel: "EN", labelKey: "profile.language.english" },
];

function normalizeLanguage(languageCode) {
  const code = String(languageCode || "").toLowerCase();
  if (code.startsWith("tr")) return "tr";
  if (code.startsWith("en")) return "en";
  return "tr";
}

const languageDetector = {
  type: "languageDetector",
  async: true,
  detect: async (callback) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        callback(normalizeLanguage(savedLanguage));
        return;
      }
    } catch {
      /* ignore */
    }

    const deviceLanguage = getLocales()?.[0]?.languageCode;
    callback(normalizeLanguage(deviceLanguage));
  },
  init: () => {},
  cacheUserLanguage: async (languageCode) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(languageCode));
    } catch {
      /* ignore */
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    fallbackLng: "tr",
    supportedLngs: ["tr", "en"],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
