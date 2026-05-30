"use client";

import { ChevronLeft, ChevronRight, Info, ListVideo } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useLocalStorage } from "usehooks-ts";
import { showAdSkipFeedbackToast } from "@/components/ad-skip-feedback-toast";
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
import {
  findMatchesStream,
  saveContentProfile,
  saveVideoAspectRatio,
} from "@/lib/actions/content";
import { saveWatchProgress } from "@/lib/actions/history";
import type { ContentProfile, Episode, Video } from "@/lib/adapters/types";
import {
  getPlaybackKind,
  inferContentProfile,
  isPortraitAspectRatio,
  mergeContentProfiles,
} from "@/lib/content-profile";
import type { AdSkipDebugSnapshot } from "@/lib/player/ad-feedback";
import { cn } from "@/lib/utils";

interface WatchProgress {
  epIndex: number;
  progress: number;
  duration: number;
}

interface WatchSource {
  name: string;
  sourceId: string;
  videoId: string;
  episodes: Episode[];
  contentProfile?: ContentProfile | null;
}

interface WatchClientProps {
  video: Video;
  sources: WatchSource[];
  dictionary: Messages;
  initialEpisodeIndex: number;
  initialSourceId: string;
  progressPromise?: Promise<WatchProgress | null>;
  initialAspectRatio?: string | null;
  initialMediaAspectRatio?: string | null;
  initialContentProfile?: ContentProfile | null;
}

// Client-side cache for discovered sources to prevent resets during navigation
const matchesCache = new Map<string, WatchSource[]>();

export default function WatchClient({
  video,
  sources: initialSources,
  dictionary,
  initialEpisodeIndex,
  initialSourceId,
  progressPromise,
  initialAspectRatio,
  initialMediaAspectRatio,
  initialContentProfile,
}: WatchClientProps) {
  // Local state for the currently ACTIVE playback (not necessarily the one in URL yet)
  const [activeSourceId, setActiveSourceId] = React.useState(initialSourceId);
  const [activeEpisodeIndex, setActiveEpisodeIndex] =
    React.useState(initialEpisodeIndex);
  const activeSourceIdRef = React.useRef(activeSourceId);
  const activeEpisodeIndexRef = React.useRef(activeEpisodeIndex);
  const [initialProgress, setInitialProgress] = React.useState(0);
  const [autoSkip, setAutoSkip] = useLocalStorage("auto-skip", false, {
    initializeWithValue: false,
  });
  const [autoNext, setAutoNext] = useLocalStorage(
    "short-drama-auto-next",
    true,
    { initializeWithValue: false },
  );
  const [hlsResourcePromise] = React.useState(() =>
    import("hls.js").then((module) => module.default),
  );
  const [contentProfile, setContentProfile] = React.useState(() =>
    initialContentProfile
      ? initialContentProfile
      : inferContentProfile(video, { aspectRatio: initialAspectRatio }),
  );
  const lastSyncTimeRef = React.useRef<number>(0);
  const knownAspectRatioKeysRef = React.useRef(new Set<string>());
  const mediaAspectRatioCacheRef = React.useRef(new Map<string, string>());
  const savedProfileKeysRef = React.useRef(new Set<string>());
  const activeEpisodeItemRef = React.useRef<HTMLLIElement | null>(null);
  const promptedAdFeedbackKeysRef = React.useRef(new Set<string>());

  const pathname = usePathname();
  const router = useRouter();

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

  React.useEffect(() => {
    const initialKey = `${initialSourceId}:${video.id}`;
    const initialMediaRatio = initialMediaAspectRatio ?? initialAspectRatio;

    if (initialMediaRatio) {
      knownAspectRatioKeysRef.current.add(initialKey);
      mediaAspectRatioCacheRef.current.set(initialKey, initialMediaRatio);
    }
  }, [initialAspectRatio, initialMediaAspectRatio, initialSourceId, video.id]);

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
        const iterator = await findMatchesStream({
          title: video.title,
          year: video.year,
          type: video.type,
        });

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
                    contentProfile: inferContentProfile(match.video),
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
  const currentAspectRatioKey = `${currentSource.sourceId}:${currentSource.videoId}`;
  const mediaAspectRatio =
    mediaAspectRatioCacheRef.current.get(currentAspectRatioKey) ??
    (currentAspectRatioKey === `${initialSourceId}:${video.id}`
      ? (initialMediaAspectRatio ?? initialAspectRatio ?? null)
      : null);
  const playbackKind = getPlaybackKind(contentProfile);
  const isShortDrama = playbackKind === "short-drama";
  const isPortraitPlayerLayout =
    isShortDrama &&
    (isPortraitAspectRatio(mediaAspectRatio) ||
      contentProfile.signals.includes("portrait-video"));
  const previousEpisodeIndex = activeEpisodeIndex - 1;
  const nextEpisodeIndex = activeEpisodeIndex + 1;
  const hasPreviousEpisode = previousEpisodeIndex >= 0;
  const hasNextEpisode = nextEpisodeIndex < currentSource.episodes.length;
  const nextEpisode = hasNextEpisode
    ? currentSource.episodes[nextEpisodeIndex]
    : undefined;
  const playerShellClassName = cn(
    "w-full mx-auto lg:px-6",
    isPortraitPlayerLayout ? "max-w-md sm:max-w-lg" : "max-w-7xl",
  );
  const playerAspectRatio = isPortraitPlayerLayout ? "9 / 16" : "16 / 9";
  const setActiveEpisodeItem = React.useCallback(
    (node: HTMLLIElement | null) => {
      activeEpisodeItemRef.current = node;
      if (!node || !isShortDrama) return;

      node.scrollIntoView({
        block: "nearest",
        inline: "center",
      });
    },
    [isShortDrama],
  );

  React.useEffect(() => {
    const sourceProfile = currentSource.contentProfile;
    if (!sourceProfile) return;

    setContentProfile((current) =>
      mergeContentProfiles(current, sourceProfile),
    );
  }, [currentSource.contentProfile]);

  React.useEffect(() => {
    if (!isShortDrama || !hasNextEpisode) return;

    const nextUrl = new URL(`./${nextEpisodeIndex + 1}`, window.location.href);
    router.prefetch(nextUrl.pathname);
  }, [hasNextEpisode, isShortDrama, nextEpisodeIndex, router]);

  React.useEffect(() => {
    if (contentProfile.confidence <= 0) return;

    const profileKey = `${currentSource.sourceId}:${currentSource.videoId}:${contentProfile.kind}:${contentProfile.confidence}:${contentProfile.signals.join(",")}`;
    if (savedProfileKeysRef.current.has(profileKey)) return;
    savedProfileKeysRef.current.add(profileKey);

    void saveContentProfile({
      sourceId: currentSource.sourceId,
      videoId: currentSource.videoId,
      resourceUrl: currentEpisode?.url ?? null,
      profile: contentProfile,
    }).catch(() => {
      savedProfileKeysRef.current.delete(profileKey);
    });
  }, [
    contentProfile,
    currentEpisode?.url,
    currentSource.sourceId,
    currentSource.videoId,
  ]);

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
    const sourceProfile = newSource?.contentProfile;
    if (sourceProfile) {
      setContentProfile((current) =>
        mergeContentProfiles(current, sourceProfile),
      );
    }

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

  const handleStepEpisode = React.useCallback(
    (direction: -1 | 1) => {
      const nextIndex = activeEpisodeIndex + direction;
      if (nextIndex < 0 || nextIndex >= currentSource.episodes.length) return;
      handleEpisodeClick(nextIndex);
    },
    [activeEpisodeIndex, currentSource.episodes.length, handleEpisodeClick],
  );

  const handleAutoAdvance = React.useCallback(() => {
    if (!isShortDrama || !autoNext || !hasNextEpisode) return;
    handleEpisodeClick(nextEpisodeIndex);
  }, [
    autoNext,
    handleEpisodeClick,
    hasNextEpisode,
    isShortDrama,
    nextEpisodeIndex,
  ]);

  const handleAdSkip = React.useEffectEvent((snapshot: AdSkipDebugSnapshot) => {
    if (document.fullscreenElement) return;

    const feedbackKey = `${currentSource.sourceId}:${currentSource.videoId}:${activeEpisodeIndex}`;
    if (promptedAdFeedbackKeysRef.current.has(feedbackKey)) return;

    promptedAdFeedbackKeysRef.current.add(feedbackKey);
    showAdSkipFeedbackToast(dictionary, {
      context: {
        episodeIndex: activeEpisodeIndex,
        episodeName: currentEpisode?.name,
        sourceId: currentSource.sourceId,
        sourceName: currentSource.name,
        videoId: currentSource.videoId,
        videoTitle: video.title,
      },
      snapshot,
    });
  });

  const handleVideoMetadata = React.useEffectEvent(
    ({ width, height }: { width: number; height: number }) => {
      if (width <= 0 || height <= 0) return;

      const nextAspectRatio = `${width} / ${height}`;
      mediaAspectRatioCacheRef.current.set(
        currentAspectRatioKey,
        nextAspectRatio,
      );
      const inferredProfile = inferContentProfile(video, {
        aspectRatio: nextAspectRatio,
        width,
        height,
      });
      setContentProfile((current) =>
        mergeContentProfiles(current, inferredProfile),
      );

      if (knownAspectRatioKeysRef.current.has(currentAspectRatioKey)) {
        return;
      }

      knownAspectRatioKeysRef.current.add(currentAspectRatioKey);
      void saveVideoAspectRatio({
        sourceId: currentSource.sourceId,
        videoId: currentSource.videoId,
        width,
        height,
        resourceUrl: currentEpisode?.url ?? null,
      })
        .then((result) => {
          if (!result.success) {
            knownAspectRatioKeysRef.current.delete(currentAspectRatioKey);
          }
        })
        .catch(() => {
          knownAspectRatioKeysRef.current.delete(currentAspectRatioKey);
        });
    },
  );

  // Progress syncing logic lifted from VideoPlayer
  const handleProgressSync = React.useEffectEvent(
    (time: number, duration: number, isBeacon = false) => {
      // Network Sync (Beacon vs Fetch)
      if (isBeacon) {
        const payload = JSON.stringify({
          videoId: currentSource.videoId,
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
            videoId: currentSource.videoId,
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
        <React.Suspense
          fallback={
            <div className={playerShellClassName}>
              <div
                className={cn(
                  "bg-muted animate-pulse rounded-lg",
                  isPortraitPlayerLayout ? "aspect-[9/16]" : "aspect-video",
                )}
                style={{
                  aspectRatio: playerAspectRatio,
                }}
              />
            </div>
          }
        >
          <div className={playerShellClassName}>
            <VideoPlayer
              className={cn(
                isPortraitPlayerLayout ? "aspect-[9/16]" : "aspect-video",
              )}
              style={{
                aspectRatio: playerAspectRatio,
              }}
              layoutAspectRatio={playerAspectRatio}
              mediaAspectRatio={mediaAspectRatio}
              videoUrl={currentEpisode.url}
              poster={video.backgroundImage || video.image}
              autoPlay={true}
              autoSkip={autoSkip}
              hlsResourcePromise={hlsResourcePromise}
              initialProgress={initialProgress}
              onProgressSync={handleProgressSync}
              onVideoMetadata={handleVideoMetadata}
              playbackProfile={playbackKind}
              nextVideoUrl={nextEpisode?.url}
              onEndedAdvance={handleAutoAdvance}
              onAdSkip={handleAdSkip}
              dictionary={dictionary}
            />
          </div>
        </React.Suspense>
      ) : (
        <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
          {dictionary.watch["no-source"]}
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 flex flex-wrap items-center gap-4 mb-6">
        {isShortDrama && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={!hasPreviousEpisode}
              title={dictionary.watch["previous-episode"]}
              onClick={() => handleStepEpisode(-1)}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">
                {dictionary.watch["previous-episode"]}
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={!hasNextEpisode}
              title={dictionary.watch["next-episode"]}
              onClick={() => handleStepEpisode(1)}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">
                {dictionary.watch["next-episode"]}
              </span>
            </Button>
            <div className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-xs font-medium text-muted-foreground">
              <ListVideo className="size-4" />
              <span>{dictionary.watch["short-drama-mode"]}</span>
            </div>
          </div>
        )}

        {isShortDrama && (
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-next"
              checked={autoNext}
              onCheckedChange={setAutoNext}
            />
            <Label
              htmlFor="auto-next"
              className="text-sm font-medium cursor-pointer"
            >
              {dictionary.watch["auto-next-label"]}
            </Label>
          </div>
        )}

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
                <span className="sr-only">
                  {dictionary.watch["ad-skip-info"]}
                </span>
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
              <ul
                className={cn(
                  "grid [content-visibility:auto] [contain-intrinsic-size:0_3rem]",
                  isShortDrama
                    ? "grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5"
                    : "grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2",
                )}
              >
                {currentSource.episodes.map((ep, index) => (
                  <li
                    key={`${ep.name}-${index}`}
                    ref={
                      activeEpisodeIndex === index
                        ? setActiveEpisodeItem
                        : undefined
                    }
                  >
                    <EpisodeCard
                      index={index}
                      isActive={activeEpisodeIndex === index}
                      href={`/watch/${currentSource.sourceId}/${currentSource.videoId}/${index + 1}`}
                      dense={isShortDrama}
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
