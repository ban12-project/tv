import type { Metadata, Viewport } from "next";
import "../globals.css";
import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/components/i18n";
import { Toaster } from "@/components/ui/sonner";
import { getDictionary } from "@/get-dictionary";
import { i18n, type Locale } from "@/i18n-config";

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const messages = await getDictionary(lang as Locale);

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
    metadataBase: new URL(process.env.NEXT_PUBLIC_HOST_URL!),
    alternates: {
      canonical: "/",
      languages: Object.fromEntries(
        Object.keys(i18n.locales).map((lang) => [lang, `/${lang}`]),
      ),
    },
    openGraph: {
      type: "website",
      siteName: messages["brand-name"],
      title: {
        default: messages["brand-name"],
        template: `%s | ${messages["brand-name"]}`,
      },
      description: messages["root-description"],
      images: `https://ban12.com/api/og?title=${messages["brand-name"]}`,
    },
    icons: {
      icon: {
        url: "https://ban12.com/api/og?w=48&h=48&bg=transparent&txt=black&txt=white",
        type: "image/png",
      },
      shortcut: {
        url: "https://ban12.com/api/og?w=192&h=192&bg=transparent&txt=black&txt=white",
        type: "image/png",
      },
      apple: [
        {
          url: "https://ban12.com/api/og?w=64&h=64&bg=transparent&txt=black&txt=white",
          type: "image/png",
        },
        {
          url: "https://ban12.com/api/og?w=180&h=180&bg=transparent&txt=black&txt=white",
          sizes: "180x180",
          type: "image/png",
        },
      ],
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

export default async function RootLayout({
  params,
  children,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider locale={lang as Locale} i18n={i18n}>
            {children}
          </LocaleProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
