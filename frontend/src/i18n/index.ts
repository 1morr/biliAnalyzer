import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

// A saved choice always wins. Otherwise follow the browser, and fall back to
// English — a first-time visitor with no Chinese locale should not be dropped
// into a Chinese UI just because that is the language it was written in.
function initialLanguage(): string {
  const saved = localStorage.getItem("lang");
  if (saved === "zh" || saved === "en") return saved;
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
