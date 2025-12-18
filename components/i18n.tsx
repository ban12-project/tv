"use client";

import { createContext, useContext } from "react";

import type { I18nConfig } from "@/i18n-config";

interface LocaleContextValue<T extends I18nConfig = I18nConfig> {
  i18n: T;
  locale: T["locales"][number] extends string ? T["locales"][number] : never;
}

const LocaleContext = createContext<LocaleContextValue>(
  {} as LocaleContextValue,
);
function LocaleProvider<T extends I18nConfig>({
  i18n,
  locale,
  children,
}: LocaleContextValue<T> & {
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <LocaleContext.Provider value={{ i18n, locale }}>
      {children}
    </LocaleContext.Provider>
  );
}

const useLocale = () => useContext(LocaleContext);

export { LocaleProvider, useLocale };
