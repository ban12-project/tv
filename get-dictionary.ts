import "server-only";
import type { Locale } from "./i18n-config";

// We enumerate all dictionaries here for better linting and typescript support
// We do not want to use dynamic imports anywhere, because that will be compiled to require("./${locale}.json") which will break Webpack
const dictionaries = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  zh: () => import("./dictionaries/zh.json").then((module) => module.default),
  id: () => import("./dictionaries/id.json").then((module) => module.default),
  ms: () => import("./dictionaries/ms.json").then((module) => module.default),
  th: () => import("./dictionaries/th.json").then((module) => module.default),
  vi: () => import("./dictionaries/vi.json").then((module) => module.default),
  fil: () => import("./dictionaries/fil.json").then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};

export type Messages = Awaited<ReturnType<typeof getDictionary>>;
