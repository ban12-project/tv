import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fetchVideoDetails } from "@/app/actions/content";
import WatchClient from "@/components/watch-client";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import type { Episode } from "@/lib/adapters/types";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
    id: string;
    ep: string;
  }>;
}>;

export default async function WatchPage({ params }: Props) {
  const { lang, id, ep } = await params;
  const dictionary = await getDictionary(lang);
  const video = await fetchVideoDetails(id);

  if (!video) {
    notFound();
  }

  // Parse episodes from vod_play_url
  // ... (parsing logic remains the same, assuming valid)
  // But wait, I need to make sure I don't delete the parsing logic if I'm replacing the whole function or parts.
  // I will use replace_file_content carefully.
  // Actually, I can just update the Props and the arguments, and the <WatchClient> call.
  // Let's do partial edits.

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
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
          Loading...
        </div>
      }
    >
      <WatchClient
        video={video}
        episodes={episodes}
        dictionary={dictionary}
        lang={lang}
        episodeIndex={validIndex}
      />
    </Suspense>
  );
}
