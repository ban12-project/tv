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
    <WatchClient
      video={video}
      episodes={episodes}
      dictionary={dictionary}
      lang={lang}
      episodeIndex={validIndex}
    />
  );
}

function Loading() {
  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col">
      <div className="flex-1 flex flex-col">
        {/* Main Player Area Skeleton */}
        <div className="w-full bg-black relative">
          <div className="w-full flex items-center justify-center">
            <div className="w-full max-w-5xl aspect-video bg-neutral-900 animate-pulse relative">
              {/* Play Button Placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Episode Selector Skeleton */}
        <div className="w-full flex-1 flex flex-col mt-8">
          <div className="px-4 md:px-12 mb-4 space-y-2">
            {/* Header Skeleton */}
            <Skeleton className="h-8 w-32 bg-white/10" />
            {/* Subheader/Show Title Skeleton */}
            <Skeleton className="h-5 w-48 bg-white/10" />
          </div>

          <div className="w-full overflow-hidden pb-12 px-4 md:px-12">
            <div className="flex gap-4">
              {/* Generate a few card skeletons */}
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-none w-72 md:w-80 flex flex-col gap-2"
                >
                  {/* Thumbnail Skeleton */}
                  <Skeleton className="aspect-video w-full rounded-lg bg-neutral-800" />

                  <div className="flex flex-col px-1 mt-2 space-y-2">
                    {/* Title Skeleton */}
                    <Skeleton className="h-5 w-3/4 bg-white/10" />
                    {/* Duration Skeleton */}
                    <Skeleton className="h-4 w-12 bg-white/10" />
                    {/* Description Skeleton */}
                    <div className="space-y-1 mt-1">
                      <Skeleton className="h-3 w-full bg-white/10" />
                      <Skeleton className="h-3 w-2/3 bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
