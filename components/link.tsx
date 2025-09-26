"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { i18n, type Locale } from "@/i18n-config";

type Props = React.ComponentPropsWithRef<typeof NextLink>;

export default React.forwardRef<React.ComponentRef<"a">, Props>(function Link(
  { href, ...rest },
  forwardedRef,
) {
  const pathname = usePathname();
  const segment = pathname.split("/")[1];
  const locale = i18n.locales.includes(segment as Locale) ? segment : null;

  const isExternal =
    typeof href === "string"
      ? href.startsWith("http")
      : Boolean(href.pathname?.startsWith("http"));

  if (isExternal || !locale)
    return <NextLink {...rest} href={href} ref={forwardedRef} />;

  const hrefWithLocale =
    typeof href === "string"
      ? `/${locale}${href}`
      : {
          ...href,
          pathname: `/${locale}${href.pathname ?? ""}`,
        };

  return <NextLink {...rest} href={hrefWithLocale} ref={forwardedRef} />;
});
