import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { fetchVideoDetails } from "@/app/actions/content";
import { Skeleton } from "@/components/ui/skeleton";
import WatchClient from "@/components/watch-client";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import type { Episode } from "@/lib/adapters/types";

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
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
  const { lang, id, ep } = await params;
  const dictionary = await getDictionary(lang);
  const video = await fetchVideoDetails(id);

  if (!video) {
    notFound();
  }

  const episodeIndex = parseInt(ep, 10) - 1;
  const validIndex =
    !Number.isNaN(episodeIndex) && episodeIndex >= 0 ? episodeIndex : 0;

  // Format assumption: "Name$Url#Name$Url"
  let episodes: Episode[] = [];

  if (video.episodes && video.episodes.length > 0) {
    episodes = video.episodes;
  } else if (video.vod_play_url) {
    const segments = video.vod_play_url.split("#");
    episodes = segments
      .map((segment) => {
        // Split by $ to get name and url.
        // Handle cases where Name might be missing or there are multiple $.
        const parts = segment.split("$");

        if (parts.length >= 2) {
          // Usually parts[0] is Name, parts[1] is URL.
          // Ensure URL starts with http to be safe, though some might be relative?
          // MacCMS usually absolute.
          return { name: parts[0], url: parts[1] };
        }

        // If no $, assume it's just a raw URL
        return {
          name: `Episode ${segments.indexOf(segment) + 1}`,
          url: segment,
        };
      })
      .filter(
        (ep) =>
          ep.url && (ep.url.startsWith("http") || ep.url.startsWith("//")),
      );
  }

  // If parsing failed or no url, might be a single raw url in the field?
  // (Covered by split condition above if it didn't have #)

  return (
    <main className="grid gap-8">
      <WatchClient
        video={video}
        episodes={episodes}
        dictionary={dictionary}
        lang={lang}
        episodeIndex={validIndex}
      />

      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            {video.title}
          </h1>

          <div className="flex items-center space-x-4 text-sm md:text-base text-gray-300 font-medium">
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

          <p className="text-lg text-gray-100 leading-relaxed line-clamp-4">
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
                <h3 className="text-xl font-semibold mb-4 text-gray-200">
                  Cast
                </h3>
                <div className="flex flex-wrap gap-2 text-gray-400">
                  {video.cast.map((c) => (
                    <span
                      key={c}
                      className="bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-6 text-sm text-gray-400">
            {video.director && (
              <div>
                <span className="block text-gray-500 mb-1">Director</span>
                <span className="text-white">{video.director}</span>
              </div>
            )}
            {video.releaseDate && (
              <div>
                <span className="block text-gray-500 mb-1">Released</span>
                <span className="text-white">{video.releaseDate}</span>
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
    <main className="grid gap-8">
      {/* Main Player Area Skeleton */}
      <div className="w-full max-w-7xl mx-auto lg:px-8 aspect-video bg-neutral-900 animate-pulse relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Episode Selector Skeleton */}
      <ul className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
        <li className="flex flex-wrap gap-2">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              key={i}
              className="w-12 h-12 rounded-lg bg-neutral-800"
            />
          ))}
        </li>
      </ul>

      {/* Info Section Skeleton */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl space-y-6">
          {/* Title */}
          <Skeleton className="h-10 md:h-16 w-3/4 bg-white/10" />

          {/* Metadata */}
          <div className="flex items-center space-x-4">
            <Skeleton className="h-5 w-12 bg-white/10" />
            <span className="text-gray-600">•</span>
            <Skeleton className="h-5 w-32 bg-white/10" />
            <span className="text-gray-600">•</span>
            <Skeleton className="h-5 w-16 bg-white/10" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-full bg-white/10" />
            <Skeleton className="h-5 w-full bg-white/10" />
            <Skeleton className="h-5 w-2/3 bg-white/10" />
          </div>
        </div>
      </section>

      {/* Additional Details Skeleton */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            {/* Cast */}
            <Skeleton className="h-7 w-16 mb-4 bg-white/10" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                  key={i}
                  className="h-8 w-24 rounded-full bg-neutral-900 border border-neutral-800"
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Director */}
            <div>
              <Skeleton className="h-5 w-16 mb-2 bg-white/10" />
              <Skeleton className="h-5 w-32 bg-white/10" />
            </div>
            {/* Release Date */}
            <div>
              <Skeleton className="h-5 w-16 mb-2 bg-white/10" />
              <Skeleton className="h-5 w-24 bg-white/10" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
