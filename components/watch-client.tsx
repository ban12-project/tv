"use client";

import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import * as React from "react";
import { useLocalStorage } from "usehooks-ts";
import { EpisodeCard } from "@/components/episode-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoPlayer from "@/components/video-player";
import type { Messages } from "@/get-dictionary";
import { findMatchesStream } from "@/lib/actions/content";
import { saveWatchProgress } from "@/lib/actions/history";
import type { Episode, Video } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

// import { dependencies } from "@/package.json";

// const HLS_VERSION = dependencies["hls.js"].replace("^", "").replace("~", "");

interface WatchProgress {
  epIndex: number;
  progress: number;
  duration: number;
}

interface WatchClientProps {
  video: Video;
  sources: {
    name: string;
    sourceId: string;
    videoId: string;
    episodes: Episode[];
  }[];
  dictionary: Messages;
  initialEpisodeIndex: number;
  initialSourceId: string;
  progressPromise?: Promise<WatchProgress | null>;
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
  initialEpisodeIndex,
  initialSourceId,
  progressPromise,
}: WatchClientProps) {
  // Local state for the currently ACTIVE playback (not necessarily the one in URL yet)
  const [activeSourceId, setActiveSourceId] = React.useState(initialSourceId);
  const [activeEpisodeIndex, setActiveEpisodeIndex] =
    React.useState(initialEpisodeIndex);
  const activeSourceIdRef = React.useRef(activeSourceId);
  const activeEpisodeIndexRef = React.useRef(activeEpisodeIndex);
  const [initialProgress, setInitialProgress] = React.useState(0);
  const [autoSkip, setAutoSkip] = useLocalStorage("auto-skip", true, {
    initializeWithValue: false,
  });
  const [hlsLoader] = React.useState(() => {
    let resolve!: (value: typeof import("hls.js").default) => void;
    // Check if resolved on init (client-side only optimization)
    const getHls = () =>
      // biome-ignore lint/suspicious/noExplicitAny: explicit bypass for window.Hls
      typeof window !== "undefined" ? (window as any).Hls : undefined;
    const initialHls = getHls();

    const promise = new Promise<typeof import("hls.js").default>((r) => {
      resolve = r;
      if (initialHls) r(initialHls);
    });

    const handleLoaded = () => {
      const hls = getHls();
      if (hls) resolve(hls);
    };

    return { promise, handleLoaded };
  });

  const lastSyncTimeRef = React.useRef<number>(0);

  const pathname = usePathname();

  const setActivePlayback = React.useCallback(
    (sourceId: string, episodeIndex: number) => {
      activeSourceIdRef.current = sourceId;
      activeEpisodeIndexRef.current = episodeIndex;
      setActiveSourceId(sourceId);
      setActiveEpisodeIndex(episodeIndex);
    },
    [],
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!progressPromise) return;

    progressPromise.then((history) => {
      if (cancelled) return;

      const progress = history?.progress ?? 0;
      const stillOnInitialPlayback =
        activeSourceIdRef.current === initialSourceId &&
        activeEpisodeIndexRef.current === initialEpisodeIndex;

      if (
        stillOnInitialPlayback &&
        history?.epIndex === initialEpisodeIndex &&
        progress > 0
      ) {
        setInitialProgress(progress);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [progressPromise, initialSourceId, initialEpisodeIndex]);

  // Sync state with URL changes (supports pushState and browser back/forward)
  React.useEffect(() => {
    const parts = pathname.split("/");
    // Structure: /.../watch/[sourceId]/[id]/[ep]
    const epStr = parts[parts.length - 1];
    const sourceId = parts[parts.length - 3];

    const epIndex = Number.parseInt(epStr, 10) - 1;
    const nextEpisodeIndex = Number.isNaN(epIndex)
      ? activeEpisodeIndexRef.current
      : epIndex;
    const nextSourceId = sourceId
      ? decodeURIComponent(sourceId)
      : activeSourceIdRef.current;

    setActivePlayback(nextSourceId, nextEpisodeIndex);
  }, [pathname, setActivePlayback]); // Only react to pathname changes to avoid circular updates

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
    setActivePlayback(initialSourceId, initialEpisodeIndex);
  }, [initialSourceId, initialEpisodeIndex, setActivePlayback]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally narrow deps - findMatchesStream only uses video.id/title internally
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
  }, [video.id, video.title]); // Use primitives to avoid re-runs on unrelated property changes

  const currentSource =
    sources.find((s) => s.sourceId === activeSourceId) || sources[0];
  const currentEpisode = currentSource.episodes[activeEpisodeIndex];
  const showEpisodeList = currentSource.episodes.length > 1;

  // Logic to handle source change (tabs click)
  const handleSourceChange = (newSourceId: string) => {
    if (newSourceId === activeSourceId) return;

    // Reset progress when switching sources
    setInitialProgress(0);

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
    setActivePlayback(newSourceId, newEpisodeIndex);

    // Update URL shallowly
    const url = new URL(
      `../../${encodeURIComponent(newSourceId)}/${targetVideoId}/${newEpisodeIndex + 1}`,
      window.location.href,
    );
    window.history.pushState(null, "", url.toString());
  };

  // Logic to handle episode change - memoized to avoid recreating inline handlers
  const handleEpisodeClick = React.useCallback(
    (index: number) => {
      if (index === activeEpisodeIndex) return;

      // Reset progress when switching episodes
      setInitialProgress(0);
      setActivePlayback(activeSourceIdRef.current, index);
      // Update URL shallowly - browser back/forward will be handled by the pathname sync effect
      const url = new URL(`./${index + 1}`, window.location.href);
      window.history.pushState(null, "", url.toString());
    },
    [activeEpisodeIndex, setActivePlayback],
  );

  // Progress syncing logic lifted from VideoPlayer
  const handleProgressSync = React.useEffectEvent(
    (time: number, duration: number, isBeacon = false) => {
      // Network Sync (Beacon vs Fetch)
      if (isBeacon) {
        const payload = JSON.stringify({
          videoId: video.id,
          sourceId: currentSource.sourceId,
          epIndex: activeEpisodeIndex,
          progress: time,
          duration,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/history", payload);
        } else {
          fetch("/api/history", {
            method: "POST",
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } else {
        // Throttled server action sync
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 15000 && time > 5) {
          lastSyncTimeRef.current = now;
          saveWatchProgress({
            videoId: video.id,
            sourceId: currentSource.sourceId,
            epIndex: activeEpisodeIndex,
            progress: time,
            duration,
          }).catch(() => {});
        }
      }
    },
  );

  return (
    <>
      {/* Main Player Area */}
      {currentEpisode ? (
        <>
          {/* TODO: https://mirrors.sustech.edu.cn/cdnjs/ajax/libs/hls.js/${HLS_VERSION}/hls.min.js
            related issue: https://github.com/cdnjs/cdnjs/issues/14263
          */}
          <Script
            src={`https://mirrors.sustech.edu.cn/cdnjs/ajax/libs/hls.js/1.6.13/hls.min.js`}
            onReady={hlsLoader.handleLoaded}
          />
          <React.Suspense
            fallback={
              <div className="w-full max-w-7xl mx-auto lg:px-6 aspect-video bg-muted animate-pulse rounded-lg" />
            }
          >
            <VideoPlayer
              className="w-full max-w-7xl mx-auto lg:px-6 aspect-video"
              videoUrl={currentEpisode.url}
              poster={video.backgroundImage || video.image}
              autoPlay={true}
              autoSkip={autoSkip}
              hlsResourcePromise={hlsLoader.promise}
              initialProgress={initialProgress}
              onProgressSync={handleProgressSync}
              dictionary={dictionary}
            />
          </React.Suspense>
        </>
      ) : (
        <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
          {dictionary.watch["no-source"] ?? "No playable source found."}
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 flex items-center gap-4 mb-6">
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-skip"
            checked={autoSkip}
            onCheckedChange={setAutoSkip}
          />
          <Label
            htmlFor="auto-skip"
            className="text-sm font-medium cursor-pointer"
          >
            {dictionary.watch["ad-skip-label"]}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 rounded-full"
              >
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Info</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="center"
              className="max-w-50 text-xs"
            >
              <p>{dictionary.watch["ad-skip-description"]}</p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <Tabs
          defaultValue={showEpisodeList ? "episodes" : "sources"}
          className="w-full"
        >
          <TabsList className="bg-secondary border border-border h-11 w-full sm:w-fit justify-start p-1 gap-1 mb-6">
            {showEpisodeList && (
              <TabsTrigger
                value="episodes"
                className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md px-6 py-2 transition-colors duration-200"
              >
                {dictionary.watch["episode-list"]}
              </TabsTrigger>
            )}
            <TabsTrigger
              value="sources"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md px-6 py-2 transition-colors duration-200"
            >
              {dictionary.watch["sources-list"]}
            </TabsTrigger>
          </TabsList>

          {showEpisodeList && (
            <TabsContent
              value="episodes"
              className="mt-0 outline-none focus-visible:ring-0"
            >
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2 [content-visibility:auto] [contain-intrinsic-size:0_3rem]">
                {currentSource.episodes.map((ep, index) => (
                  <li key={`${ep.name}-${index}`}>
                    <EpisodeCard
                      index={index}
                      isActive={activeEpisodeIndex === index}
                      href={`/watch/${currentSource.sourceId}/${video.id}/${index + 1}`}
                      onClick={handleEpisodeClick}
                    />
                  </li>
                ))}
              </ul>
            </TabsContent>
          )}

          <TabsContent
            value="sources"
            className="mt-0 outline-none focus-visible:ring-0"
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
              {sources.map((source) => (
                <Button
                  key={source.sourceId}
                  type="button"
                  onClick={() => handleSourceChange(source.sourceId)}
                  className={cn(
                    "w-full justify-around group hover:bg-accent",
                    activeSourceId === source.sourceId
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {source.name}
                  <span className="text-xs text-neutral-500">
                    {source.episodes.length} {dictionary.watch.episodes}
                  </span>
                </Button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
