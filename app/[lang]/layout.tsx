import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/components/i18n";
import { Toaster } from "@/components/ui/sonner";
import { getDictionary } from "@/get-dictionary";
import { i18n, type Locale } from "@/i18n-config";
import {
  absoluteUrl,
  getPublicHostUrl,
  JsonLdScript,
  localeAlternates,
  siteJsonLd,
} from "@/lib/seo";

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const messages = await getDictionary(lang as Locale);
  const publicHostUrl = getPublicHostUrl();
  const canonical = `/${lang}`;

  return {
    applicationName: messages["brand-name"],
    title: {
      default: messages["brand-name"],
      template: `%s | ${messages["brand-name"]}`,
    },
    description: messages["root-description"],
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: messages["brand-name"],
    },
    formatDetection: {
      telephone: false,
    },
    metadataBase: new URL(publicHostUrl),
    alternates: {
      canonical,
      languages: localeAlternates(),
    },
    openGraph: {
      type: "website",
      url: absoluteUrl(canonical),
      siteName: messages["brand-name"],
      title: {
        default: messages["brand-name"],
        template: `%s | ${messages["brand-name"]}`,
      },
      description: messages["root-description"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  width: "device-width",
  viewportFit: "cover",
};

export function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }));
}

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export default async function RootLayout({
  params,
  children,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const messages = await getDictionary(lang as Locale);

  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${geist.variable} font-sans bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider locale={lang as Locale} i18n={i18n}>
            <JsonLdScript
              data={siteJsonLd({
                lang: lang as Locale,
                name: messages["brand-name"],
                description: messages["root-description"],
              })}
            />
            {children}
          </LocaleProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
