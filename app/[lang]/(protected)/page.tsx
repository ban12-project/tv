import { Loader2Icon } from "lucide-react";
import { Suspense, ViewTransition } from "react";
import { fetchHomeContent } from "@/app/actions/content";
import { ContentRow } from "@/components/content-row";
import { HeroCarousel } from "@/components/hero-carousel";

export default function Home() {
  return (
    <main>
      <ViewTransition>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              <Loader2Icon className="animate-spin" />
            </div>
          }
        >
          <Suspended />
        </Suspense>
      </ViewTransition>
    </main>
  );
}

async function Suspended() {
  const { trending, newReleases } = await fetchHomeContent();

  return (
    <>
      <HeroCarousel videos={trending.slice(0, 5)} />

      <div className="space-y-4 pb-20 -mt-20 relative z-20">
        {trending.length > 0 && (
          <ContentRow title="Trending Now" videos={trending} />
        )}

        {newReleases.length > 0 && (
          <ContentRow title="New Releases" videos={newReleases} />
        )}
      </div>
    </>
  );
}
