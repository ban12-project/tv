import { headers } from "next/headers";
import { Suspense, ViewTransition } from "react";
import { getAllowList } from "@/app/actions";
import Link from "@/components/link";
import { Menu } from "@/components/menu";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { SearchDialog } from "@/components/search-dialog";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { sourceProvider } from "@/lib/source-provider";
import { AllowlistDialog } from "./allowlist-dialog";

async function MenuLoader({
  lang,
  children,
}: {
  lang: Locale;
  children?: React.ReactNode;
}) {
  const categories = await sourceProvider.getCategories();
  const dictionary = await getDictionary(lang);
  return (
    <Menu categories={categories} dictionary={dictionary}>
      {children}
    </Menu>
  );
}

export default async function Header({
  params,
}: Pick<LayoutProps<"/[lang]">, "params">) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang as Locale);

  return (
    <ScrollAwareHeader>
      <header className="sticky top-0 w-full z-50 transition-colors duration-300 border-b border-transparent bg-transparent data-[scrolled=true]:bg-black/80 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:border-white/10">
        <div className="px-6 md:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Navigation */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center space-x-2">
                {dictionary.header.home}
              </Link>

              <ViewTransition>
                <Suspense>
                  <MenuLoader lang={lang as Locale}>
                    <SuspendedAllowlistDialog lang={lang as Locale} />
                  </MenuLoader>
                </Suspense>
              </ViewTransition>
            </div>

            {/* Search and Sign In */}
            <div className="flex items-center gap-4">
              <SearchDialog dictionary={dictionary} lang={lang} />
            </div>
          </div>
        </div>
      </header>
    </ScrollAwareHeader>
  );
}

async function SuspendedAllowlistDialog({ lang }: { lang: Locale }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isRealUser = session && !session.user.isAnonymous;

  if (!isRealUser) return null;

  const emailsPromise = getAllowList();
  const dictionary = await getDictionary(lang);

  return (
    <AllowlistDialog emailsPromise={emailsPromise} dictionary={dictionary} />
  );
}
