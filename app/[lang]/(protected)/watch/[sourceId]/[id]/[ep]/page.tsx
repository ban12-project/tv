import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { fetchVideoDetails } from "@/app/actions/content";
import { checkIsRecommended } from "@/app/actions/recommendations";
import { RecommendationDialog } from "@/components/recommendation-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import WatchClient from "@/components/watch-client";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import type { Episode } from "@/lib/adapters/types";

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
    sourceId: string;
    id: string;
    ep: string;
  }>;
}>;

export default function WatchPage({ params }: Props) {
  return (
    <ViewTransition>
      <Suspense fallback={<Loading />}>
        <Suspended params={params} />
      </Suspense>
    </ViewTransition>
  );
}

async function Suspended({ params }: Props) {
  const { lang, sourceId, id, ep } = await params;
  const dictionary = await getDictionary(lang);

  // Clean sourceId if needed (decoder?) - usually Next.js handles decoding
  const decodedSourceId = decodeURIComponent(sourceId);

  const video = await fetchVideoDetails(id, decodedSourceId);

  if (!video) {
    notFound();
  }

  // Promise for checking status (don't await here)
  const isRecommendedPromise = checkIsRecommended(decodedSourceId, id);

  const episodeIndex = Number.parseInt(ep, 10) - 1;
  const validIndex =
    !Number.isNaN(episodeIndex) && episodeIndex >= 0 ? episodeIndex : 0;

  // Matches are now fetched client-side in WatchClient via streaming
  const sourceGroups: {
    name: string;
    sourceId: string;
    videoId: string;
    episodes: Episode[];
  }[] = [];

  // Add current video as first source
  sourceGroups.push({
    name: video.sourceName || `Source (${decodedSourceId})`,
    sourceId: decodedSourceId,
    videoId: id,
    episodes: video.episodes || [],
  });

  return (
    <main className="space-y-8">
      <WatchClient
        video={video}
        sources={sourceGroups}
        dictionary={dictionary}
        lang={lang}
        initialEpisodeIndex={validIndex}
        currentSourceId={decodedSourceId}
      />

      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-end gap-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {video.title}
            </h1>
            <Suspense fallback={<Skeleton className="h-4 w-4" />}>
              <RecommendationDialog
                video={{
                  title: video.title,
                  description: video.description,
                  image: video.image,
                  sourceId: decodedSourceId,
                  id: id,
                  ep: ep,
                }}
                dictionary={dictionary}
                isRecommended={isRecommendedPromise}
              />
            </Suspense>
          </div>

          <div className="flex items-center space-x-4 text-sm md:text-base text-muted-foreground font-medium">
            {video.year && <span>{video.year}</span>}
            <span>•</span>
            <span>{video.genre.join(", ")}</span>
            {video.duration && (
              <>
                <span>•</span>
                <span>{video.duration}</span>
              </>
            )}
          </div>

          <p className="text-lg text-foreground/90 leading-relaxed line-clamp-4">
            {video.description}
          </p>
        </div>
      </section>

      {/* Additional Details */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            {/* Cast */}
            {video.cast && video.cast.length > 0 && (
              <>
                <h3 className="text-xl font-semibold mb-4 text-foreground/90">
                  {dictionary.watch?.cast ?? "Cast"}
                </h3>
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  {video.cast.map((c) => (
                    <span
                      key={c}
                      className="bg-secondary px-3 py-1 rounded-full border border-border"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-6 text-sm text-muted-foreground">
            {video.director && (
              <div>
                <span className="block text-muted-foreground/60 mb-1">
                  {dictionary.watch?.director ?? "Director"}
                </span>
                <span className="text-foreground">{video.director}</span>
              </div>
            )}
            {video.releaseDate && (
              <div>
                <span className="block text-muted-foreground/60 mb-1">
                  {dictionary.watch?.released ?? "Released"}
                </span>
                <span className="text-foreground">{video.releaseDate}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Loading() {
  return (
    <main className="space-y-8">
      {/* Main Player Area Skeleton */}
      <div className="w-full max-w-7xl mx-auto lg:px-8 aspect-video">
        <div className="w-full h-full bg-secondary animate-pulse"></div>
      </div>

      {/* Episode Selector Skeleton */}
      <ul className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <li key={i}>
            <Skeleton className="w-12 h-12 rounded-lg bg-muted" />
          </li>
        ))}
      </ul>

      {/* Info Section Skeleton */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl space-y-6">
          {/* Title */}
          <Skeleton className="h-10 md:h-16 w-3/4 bg-muted" />

          {/* Metadata */}
          <div className="flex items-center space-x-4">
            <Skeleton className="h-5 w-12 bg-muted" />
            <span className="text-gray-600">•</span>
            <Skeleton className="h-5 w-32 bg-white/10" />
            <span className="text-gray-600">•</span>
            <Skeleton className="h-5 w-16 bg-muted" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-full bg-muted" />
            <Skeleton className="h-5 w-full bg-muted" />
            <Skeleton className="h-5 w-2/3 bg-white/10" />
          </div>
        </div>
      </section>

      {/* Additional Details Skeleton */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            {/* Cast */}
            <Skeleton className="h-7 w-16 mb-4 bg-muted" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                  key={i}
                  className="h-8 w-24 rounded-full bg-secondary border border-border"
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Director */}
            <div>
              <Skeleton className="h-5 w-24 bg-muted" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
