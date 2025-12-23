"use client";

import NextLink from "next/link";
import { useLocale } from "./i18n";

export default function Link({
  href,
  ...rest
}: React.ComponentProps<typeof NextLink>) {
  const { locale } = useLocale();

  const isExternal =
    typeof href === "string"
      ? href.startsWith("http")
      : Boolean(href.pathname?.startsWith("http"));

  if (isExternal) return <NextLink {...rest} href={href} />;

  const hrefWithLocale =
    typeof href === "string"
      ? `/${locale}${href}`
      : {
          ...href,
          pathname: `/${locale}${href.pathname ?? ""}`,
        };

  return <NextLink {...rest} href={hrefWithLocale} />;
}
