import "server-only";
import type { Locale } from "./i18n-config";
import { cache } from "react";

// We enumerate all dictionaries here for better linting and typescript support
// We do not want to use dynamic imports anywhere, because that will be compiled to require("./${locale}.json") which will break Webpack
const dictionaries = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  zh: () => import("./dictionaries/zh.json").then((module) => module.default),
};

export const getDictionary = cache(async (locale: Locale) => {
  return dictionaries[locale]?.() ?? dictionaries.en();
});

export type Messages = Awaited<ReturnType<typeof getDictionary>>;
