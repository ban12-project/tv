import type { MetadataRoute } from "next";
import { i18n } from "@/i18n-config";
import { absoluteUrl, localeAlternates } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return i18n.locales.map((lang) => ({
    url: absoluteUrl(`/${lang}`),
    changeFrequency: "daily",
    priority: 1,
    alternates: {
      languages: localeAlternates(),
    },
  }));
}
