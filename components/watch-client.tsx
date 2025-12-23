"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { findMatchesStream } from "@/app/actions/content";
import { EpisodeCard } from "@/components/episode-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoPlayer from "@/components/video-player";
import type { Messages } from "@/get-dictionary";
import type { Episode, Video } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

interface WatchClientProps {
  video: Video;
  sources: {
    name: string;
    sourceId: string;
    videoId: string;
    episodes: Episode[];
  }[];
  dictionary: Messages;
  lang: string;
  initialEpisodeIndex: number;
  currentSourceId: string;
}

// Client-side cache for discovered sources to prevent resets during navigation
const matchesCache = new Map<
  string,
  { name: string; sourceId: string; videoId: string; episodes: Episode[] }[]
>();

export default function WatchClient({
  video,
  sources: initialSources,
  dictionary,
  lang,
  initialEpisodeIndex,
  currentSourceId: initialSourceId,
}: WatchClientProps) {
  const router = useRouter();

  // Local state for the currently ACTIVE playback (not necessarily the one in URL yet)
  const [activeSourceId, setActiveSourceId] = React.useState(initialSourceId);
  const [activeEpisodeIndex, setActiveEpisodeIndex] =
    React.useState(initialEpisodeIndex);

  // Sources state initialized with cached matches if any
  const [sources, setSources] = React.useState(() => {
    const cached = matchesCache.get(video.id);
    if (cached) {
      // Merge initial (current) source with cached ones
      const combined = [...initialSources];
      const existingIds = new Set(combined.map((s) => s.sourceId));
      for (const s of cached) {
        if (!existingIds.has(s.sourceId)) {
          combined.push(s);
        }
      }
      return combined;
    }
    return initialSources;
  });

  // Sync state with props if the URL changes directly (e.g. browser back button)
  React.useEffect(() => {
    setActiveSourceId(initialSourceId);
    setActiveEpisodeIndex(initialEpisodeIndex);
  }, [initialSourceId, initialEpisodeIndex]);

  // Fetch and cache matches
  React.useEffect(() => {
    let isMounted = true;
    const fetchMatches = async () => {
      try {
        const iterator = await findMatchesStream(video);

        for await (const matches of iterator) {
          if (!isMounted) break;
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
                    videoId: match.video.id,
                    episodes: match.video.episodes || [],
                  });
                }
              }
              // Update cache
              matchesCache.set(video.id, newSources);
              return newSources;
            });
          }
        }
      } catch (err) {
        console.error("Failed to stream matches", err);
      }
    };

    fetchMatches();
    return () => {
      isMounted = false;
    };
  }, [video]); // Complete video object for reliability

  const currentSource =
    sources.find((s) => s.sourceId === activeSourceId) || sources[0];
  const currentEpisode = currentSource.episodes[activeEpisodeIndex];

  // Logic to handle source change (tabs click)
  const handleSourceChange = (newSourceId: string) => {
    if (newSourceId === activeSourceId) return;

    const oldEpisode = currentSource.episodes[activeEpisodeIndex];
    let newEpisodeIndex = 0;

    const newSource = sources.find((s) => s.sourceId === newSourceId);
    if (newSource && oldEpisode) {
      // Try exact name match first
      const matchIndex = newSource.episodes.findIndex(
        (e) => e.name === oldEpisode.name,
      );
      if (matchIndex !== -1) {
        newEpisodeIndex = matchIndex;
      } else if (activeEpisodeIndex < newSource.episodes.length) {
        // Fallback to same index
        newEpisodeIndex = activeEpisodeIndex;
      }
    }

    // Move to the new source's videoId, not the current one!
    const targetVideoId = newSource?.videoId || video.id;

    // Update local state instantly for better UX
    setActiveSourceId(newSourceId);
    setActiveEpisodeIndex(newEpisodeIndex);

    // Sync transition with URL
    router.push(
      `/${lang}/watch/${newSourceId}/${targetVideoId}/${newEpisodeIndex + 1}`,
      { scroll: false },
    );
  };

  // Logic to handle episode change
  const handleEpisodeClick = (index: number, sourceId: string) => {
    const source = sources.find((s) => s.sourceId === sourceId);
    const targetVideoId = source?.videoId || video.id;

    setActiveSourceId(sourceId);
    setActiveEpisodeIndex(index);
    router.push(`/${lang}/watch/${sourceId}/${targetVideoId}/${index + 1}`, {
      scroll: false,
    });
  };

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
          {dictionary.watch["no-source"] ?? "No playable source found."}
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <Tabs defaultValue="episodes" className="w-full">
          <TabsList className="bg-neutral-900 border border-neutral-800 h-11 w-full sm:w-fit justify-start p-1 gap-1 mb-6">
            <TabsTrigger
              value="episodes"
              className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white rounded-md px-6 py-2 transition-all duration-200"
            >
              {dictionary.watch["episode-list"]}
            </TabsTrigger>
            {sources.length > 1 && (
              <TabsTrigger
                value="sources"
                className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white rounded-md px-6 py-2 transition-all duration-200"
              >
                {dictionary.watch["sources-list"]}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="episodes"
            className="mt-0 outline-none focus-visible:ring-0"
          >
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-medium text-neutral-400 mb-2">
                {currentSource.name}
              </h3>
              {currentSource.episodes.length > 0 ? (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2">
                  {currentSource.episodes.map((ep, index) => (
                    <li key={`${ep.name}-${index}`}>
                      <EpisodeCard
                        index={index}
                        isActive={activeEpisodeIndex === index}
                        href={`/watch/${currentSource.sourceId}/${video.id}/${index + 1}`}
                        onNavigate={(e) => {
                          e.preventDefault();
                          handleEpisodeClick(index, currentSource.sourceId);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-500 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/50">
                  <p className="text-sm">
                    {dictionary.watch["no-source"] ??
                      "No playable episodes found."}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {sources.length > 1 && (
            <TabsContent
              value="sources"
              className="mt-0 outline-none focus-visible:ring-0"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sources.map((source) => (
                  <Button
                    key={source.sourceId}
                    type="button"
                    onClick={() => handleSourceChange(source.sourceId)}
                    className={cn(
                      "w-full justify-around group",
                      activeSourceId === source.sourceId
                        ? "bg-neutral-800 border-neutral-700 ring-1 ring-white/10"
                        : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        activeSourceId === source.sourceId
                          ? "text-white"
                          : "text-neutral-400 group-hover:text-neutral-200",
                      )}
                    >
                      {source.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {source.episodes.length}{" "}
                      {dictionary.watch.episodes ?? "Episodes"}
                    </span>
                  </Button>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
