import type { MetadataRoute } from "next";
import { isAuthRequired } from "@/lib/features";
import { absoluteUrl, getPublicHostUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (isAuthRequired()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
      host: getPublicHostUrl(),
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/en/sign-in",
        "/en/sign-up",
        "/zh/sign-in",
        "/zh/sign-up",
        "/en/verify-cms",
        "/zh/verify-cms",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getPublicHostUrl(),
  };
}
