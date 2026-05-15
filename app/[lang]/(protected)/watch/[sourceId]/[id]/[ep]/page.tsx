import { notFound, redirect } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { RecommendationDialog } from "@/components/recommendation-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import WatchClient from "@/components/watch-client";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import {
  fetchVideoDetails,
  getContentProfile,
  getEpisodeAspectRatio,
} from "@/lib/actions/content";
import { getWatchProgress } from "@/lib/actions/history";
import {
  checkIsRecommended,
  getRecommendedVideoTitle,
} from "@/lib/actions/recommendations";
import type { ContentProfile, Episode } from "@/lib/adapters/types";
import {
  inferContentProfile,
  mergeContentProfiles,
} from "@/lib/content-profile";

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
    sourceId: string;
    id: string;
    ep: string;
  }>;
}>;

export default async function WatchPage({ params }: Props) {
  const { lang, sourceId, id, ep } = await params;

  // Clean sourceId if needed (decoder?) - usually Next.js handles decoding
  const decodedSourceId = decodeURIComponent(sourceId);
  const dictionaryPromise = getDictionary(lang);

  const [dictionary, video, initialAspectRatio, cachedContentProfile] =
    await Promise.all([
      dictionaryPromise,
      fetchVideoDetails(id, decodedSourceId),
      getEpisodeAspectRatio({
        sourceId: decodedSourceId,
        videoId: id,
      }),
      getContentProfile({
        sourceId: decodedSourceId,
        videoId: id,
      }),
    ]);

  if (!video) {
    const title = await getRecommendedVideoTitle(decodedSourceId, id);
    if (title) {
      redirect(`/${lang}?q=${encodeURIComponent(title)}`);
    }
    notFound();
  }

  // Promise for checking status (don't await here)
  const isRecommendedPromise = checkIsRecommended(decodedSourceId, id);
  const initialContentProfile = mergeContentProfiles(
    cachedContentProfile,
    inferContentProfile(video, { aspectRatio: initialAspectRatio }),
  );

  const episodeIndex = Number.parseInt(ep, 10) - 1;
  const validIndex =
    !Number.isNaN(episodeIndex) && episodeIndex >= 0 ? episodeIndex : 0;

  // Matches are now fetched client-side in WatchClient via streaming
  const sourceGroups: {
    name: string;
    sourceId: string;
    videoId: string;
    episodes: Episode[];
    contentProfile?: ContentProfile;
  }[] = [];

  // Add current video as first source
  sourceGroups.push({
    name: video.sourceName,
    sourceId: decodedSourceId,
    videoId: id,
    episodes: video.episodes || [],
    contentProfile: initialContentProfile,
  });

  // Fetch initial progress from the database (non-blocking)
  const progressPromise = getWatchProgress(id, decodedSourceId);

  return (
    <main className="space-y-8">
      <WatchClient
        video={video}
        sources={sourceGroups}
        dictionary={dictionary}
        initialEpisodeIndex={validIndex}
        initialSourceId={decodedSourceId}
        progressPromise={progressPromise}
        initialAspectRatio={initialAspectRatio}
        initialContentProfile={initialContentProfile}
      />

      <section className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-end gap-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {video.title}
            </h1>
            <ViewTransition>
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
            </ViewTransition>
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
      <section className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-12">
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
