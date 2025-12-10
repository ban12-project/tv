import { Suspense } from "react";
import { fetchHomeContent } from "@/app/actions/content";
import { ContentRow } from "@/components/content-row";
import Header from "@/components/header";
import { HeroCarousel } from "@/components/hero-carousel";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
  }>;
}>;

export default async function Home({ params }: Props) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  // Fetch dynamic content
  const { trending, newReleases } = await fetchHomeContent();

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Header dictionary={dictionary} />

      <main>
        <Suspense
          fallback={<div className="h-[85vh] bg-neutral-900 animate-pulse" />}
        >
          <HeroCarousel videos={trending.slice(0, 5)} />
        </Suspense>

        <div className="space-y-4 pb-20 -mt-20 relative z-20">
          {trending.length > 0 && (
            <ContentRow title="Trending Now" videos={trending} />
          )}

          {newReleases.length > 0 && (
            <ContentRow title="New Releases" videos={newReleases} />
          )}
        </div>
      </main>
    </div>
  );
}
