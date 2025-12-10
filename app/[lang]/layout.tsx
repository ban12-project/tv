import type { Metadata, Viewport } from "next";
import "../globals.css";
import { ThemeProvider } from "next-themes";
import Header from "@/components/header";
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
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  viewportFit: "cover",
};

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }));
}

export default async function RootLayout({
  params,
  children,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="bg-black text-white selection:bg-white selection:text-black">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
