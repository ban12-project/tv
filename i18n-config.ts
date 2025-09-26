export const i18n = {
  defaultLocale: "en",
  locales: ["en", "zh", "id", "ms", "th", "vi", "fil"],
} as const;

export type Locale = (typeof i18n)["locales"][number];
