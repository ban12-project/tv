import type { Metadata } from "next";
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
  getEpisodeLayoutMetadata,
} from "@/lib/actions/content";
import { getWatchProgress } from "@/lib/actions/history";
import {
  checkIsRecommended,
  getRecommendedVideoTitle,
} from "@/lib/actions/recommendations";
import type { ContentProfile, Episode } from "@/lib/adapters/types";
import { getCurrentSession } from "@/lib/auth-utils";
import {
  inferContentProfile,
  mergeContentProfiles,
} from "@/lib/content-profile";
import { hasAuth, hasCmsAdmin, hasDatabase } from "@/lib/features";
import {
  absoluteUrl,
  getPublicHostUrl,
  JsonLdScript,
  localeAlternates,
} from "@/lib/seo";
import { MissingApiSourcesError } from "@/lib/source-provider";

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
    sourceId: string;
    id: string;
    ep: string;
  }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, sourceId, id, ep } = await params;
  const decodedSourceId = decodeURIComponent(sourceId);
  const dictionary = await getDictionary(lang);
  const video = await fetchVideoDetails(id, decodedSourceId).catch((error) => {
    if (error instanceof MissingApiSourcesError) return null;
    throw error;
  });

  if (!video) {
    return {
      metadataBase: new URL(getPublicHostUrl()),
      title: dictionary["brand-name"],
      description: dictionary["root-description"],
    };
  }

  const path = `/watch/${sourceId}/${id}/${ep}`;
  const title = video.title;
  const description = video.description || dictionary["root-description"];
  const images = video.image ? [absoluteUrl(video.image)] : undefined;
  const openGraphType =
    video.type === "movie" ? "video.movie" : "video.tv_show";

  return {
    metadataBase: new URL(getPublicHostUrl()),
    title,
    description,
    alternates: {
      canonical: `/${lang}${path}`,
      languages: localeAlternates(path),
    },
    openGraph: {
      type: openGraphType,
      url: absoluteUrl(`/${lang}${path}`),
      siteName: dictionary["brand-name"],
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function WatchPage({ params }: Props) {
  const { lang, sourceId, id, ep } = await params;

  // Clean sourceId if needed (decoder?) - usually Next.js handles decoding
  const decodedSourceId = decodeURIComponent(sourceId);
  const dictionaryPromise = getDictionary(lang);

  let dictionary: Awaited<ReturnType<typeof getDictionary>>;
  let video: Awaited<ReturnType<typeof fetchVideoDetails>>;
  let initialLayoutMetadata: Awaited<
    ReturnType<typeof getEpisodeLayoutMetadata>
  >;
  let cachedContentProfile: Awaited<ReturnType<typeof getContentProfile>>;

  try {
    [dictionary, video, initialLayoutMetadata, cachedContentProfile] =
      await Promise.all([
        dictionaryPromise,
        fetchVideoDetails(id, decodedSourceId),
        getEpisodeLayoutMetadata({
          sourceId: decodedSourceId,
          videoId: id,
        }),
        getContentProfile({
          sourceId: decodedSourceId,
          videoId: id,
        }),
      ]);
  } catch (error) {
    if (error instanceof MissingApiSourcesError) {
      if (hasCmsAdmin()) {
        redirect(`/${lang}/verify-cms`);
      }
      notFound();
    }
    throw error;
  }

  if (!video) {
    const title = await getRecommendedVideoTitle(decodedSourceId, id);
    if (title) {
      redirect(`/${lang}?q=${encodeURIComponent(title)}`);
    }
    notFound();
  }

  const authEnabled = hasAuth();
  const session = authEnabled
    ? await getCurrentSession().catch(() => null)
    : null;
  const persistenceEnabled =
    hasDatabase() &&
    authEnabled &&
    Boolean(session && !session.user.isAnonymous);
  const isRecommendedPromise = persistenceEnabled
    ? checkIsRecommended(decodedSourceId, id)
    : Promise.resolve(false);
  const initialAspectRatio = initialLayoutMetadata?.aspectRatio ?? null;
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
  const progressPromise = persistenceEnabled
    ? getWatchProgress(id, decodedSourceId)
    : Promise.resolve(null);
  const path = `/watch/${sourceId}/${id}/${ep}`;
  const pageUrl = absoluteUrl(`/${lang}${path}`);
  const contentType = video.type === "movie" ? "Movie" : "TVSeries";

  return (
    <main className="space-y-8">
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${pageUrl}#webpage`,
              url: pageUrl,
              name: video.title,
              description: video.description,
              inLanguage: lang,
              isPartOf: { "@id": absoluteUrl("/#website") },
            },
            {
              "@type": "BreadcrumbList",
              "@id": `${pageUrl}#breadcrumb`,
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: dictionary["brand-name"],
                  item: absoluteUrl(`/${lang}`),
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: video.title,
                  item: pageUrl,
                },
              ],
            },
            {
              "@type": contentType,
              "@id": `${pageUrl}#video`,
              name: video.title,
              description: video.description,
              image: video.image ? absoluteUrl(video.image) : undefined,
              datePublished: video.releaseDate || video.year || undefined,
              genre: video.genre,
              director: video.director,
              actor: video.cast,
            },
          ],
        }}
      />
      <WatchClient
        video={video}
        sources={sourceGroups}
        dictionary={dictionary}
        initialEpisodeIndex={validIndex}
        initialSourceId={decodedSourceId}
        progressPromise={progressPromise}
        initialAspectRatio={initialAspectRatio}
        initialContentProfile={initialContentProfile}
        persistenceEnabled={persistenceEnabled}
      />

      <section className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-end gap-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {video.title}
            </h1>
            <ViewTransition>
              <Suspense fallback={<Skeleton className="h-4 w-4" />}>
                {persistenceEnabled ? (
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
                ) : null}
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
                  {dictionary.watch.cast}
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
                  {dictionary.watch.director}
                </span>
                <span className="text-foreground">{video.director}</span>
              </div>
            )}
            {video.releaseDate && (
              <div>
                <span className="block text-muted-foreground/60 mb-1">
                  {dictionary.watch.released}
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
