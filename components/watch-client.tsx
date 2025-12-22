"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { findMatchesStream } from "@/app/actions/content";
import { EpisodeCard } from "@/components/episode-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import VideoPlayer from "@/components/video-player";
import type { Messages } from "@/get-dictionary";
import type { Episode, Video } from "@/lib/adapters/types";

interface WatchClientProps {
  video: Video;
  sources: { name: string; sourceId: string; episodes: Episode[] }[];
  dictionary: Messages;
  lang: string;
  initialEpisodeIndex: number;
  currentSourceId: string;
}

export default function WatchClient({
  video,
  sources: initialSources,
  dictionary,
  lang,
  initialEpisodeIndex,
  currentSourceId,
}: WatchClientProps) {
  const router = useRouter();
  const [sources, setSources] = React.useState(initialSources);

  // Fetch matches from other sources via streaming action
  React.useEffect(() => {
    const fetchMatches = async () => {
      try {
        const iterator = await findMatchesStream(video);

        for await (const matches of iterator) {
          if (matches && matches.length > 0) {
            setSources((prev) => {
              const newSources = [...prev];
              const existingIds = new Set(newSources.map((s) => s.sourceId));

              for (const match of matches) {
                if (match.sourceId && !existingIds.has(match.sourceId)) {
                  existingIds.add(match.sourceId);
                  newSources.push({
                    name: match.sourceName || `Source (${match.sourceId})`,
                    sourceId: match.sourceId,
                    episodes: match.video.episodes || [],
                  });
                }
              }
              return newSources;
            });
          }
        }
      } catch (err) {
        console.error("Failed to stream matches", err);
      }
    };

    fetchMatches();
  }, [video]); // Dependencies: entire video object should be stable enough or rely on specific props if video object changes ref often. Usually video from server component is stable ref if simple props. Video ID/Title is better. [video.id, video.title, video.year]

  // Determine current source based on prop or match
  // We prioritize the source matching currentSourceId
  // sources array now updates dynamically
  const currentSource =
    sources.find((s) => s.sourceId === currentSourceId) || sources[0];

  const handleSourceChange = (newSourceId: string) => {
    // Find matching episode index in new source to keep continuity
    const oldEpisode = currentSource?.episodes[initialEpisodeIndex];
    let newEpisodeIndex = 0;

    if (oldEpisode) {
      const newSource = sources.find((s) => s.sourceId === newSourceId);
      if (newSource) {
        const matchIndex = newSource.episodes.findIndex(
          (e) => e.name === oldEpisode.name,
        );
        if (matchIndex !== -1) {
          newEpisodeIndex = matchIndex;
        } else if (initialEpisodeIndex < newSource.episodes.length) {
          newEpisodeIndex = initialEpisodeIndex;
        }
      }
    }

    // Navigate to new Source URL
    // Route: /watch/[sourceId]/[id]/[ep]
    // ep is 1-based index
    router.push(
      `/${lang}/watch/${newSourceId}/${video.id}/${newEpisodeIndex + 1}`,
    );
  };

  const currentEpisode = currentSource?.episodes[initialEpisodeIndex];

  return (
    <>
      {/* Main Player Area */}
      {currentEpisode ? (
        <VideoPlayer
          className="w-full max-w-7xl mx-auto lg:px-8 aspect-video"
          videoUrl={currentEpisode.url}
          poster={video.backgroundImage || video.image}
          title={`${video.title} - ${currentEpisode.name}`}
          autoPlay={true}
          dictionary={dictionary}
        />
      ) : (
        <div className="flex items-center justify-center h-[50vh] text-gray-400">
          No playable source found.
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between mt-4">
        <h2 className="text-xl font-bold text-white">
          {currentEpisode ? currentEpisode.name : "Episode List"}
        </h2>

        {sources.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Source:</span>
            <Select value={currentSourceId} onValueChange={handleSourceChange}>
              <SelectTrigger className="w-45 bg-neutral-900 border-neutral-800 text-white">
                <SelectValue placeholder="Select Source" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                {sources.map((source) => (
                  <SelectItem key={source.sourceId} value={source.sourceId}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Episode Selector */}
      {currentSource?.episodes && currentSource.episodes.length > 1 && (
        <ul className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2 mt-4">
          {currentSource.episodes.map((ep, index) => (
            <li key={`${ep.name}-${index}`}>
              <EpisodeCard
                index={index}
                isActive={initialEpisodeIndex === index}
                linkHref={`/${lang}/watch/${currentSourceId}/${video.id}/${index + 1}`}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
