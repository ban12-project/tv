import { i18n, type Locale } from "@/i18n-config";

export function getPublicHostUrl() {
  return (process.env.NEXT_PUBLIC_HOST_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function absoluteUrl(path = "/") {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${getPublicHostUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function localeAlternates(path = "") {
  return Object.fromEntries(
    i18n.locales.map((lang) => [lang, absoluteUrl(`/${lang}${path}`)]),
  );
}

export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Next.js recommends this for JSON-LD; the payload escapes '<'.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function siteJsonLd({
  lang,
  name,
  description,
}: {
  lang: Locale;
  name: string;
  description: string;
}) {
  const origin = getPublicHostUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name,
        url: origin,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name,
        url: origin,
        inLanguage: lang,
        publisher: { "@id": `${origin}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: absoluteUrl(`/${lang}?q={search_term_string}`),
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "WebApplication",
        "@id": `${origin}/#webapp`,
        name,
        description,
        url: origin,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Any",
        inLanguage: lang,
      },
    ],
  };
}
