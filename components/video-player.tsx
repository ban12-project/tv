"use client";

import IntlMessageFormat from "intl-messageformat";
import { Play, RotateCcw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Messages } from "@/get-dictionary";
import type { ContentKind } from "@/lib/adapters/types";
import type {
  AdSkipDebugSnapshot,
  AdSkipRuntimeEvent,
} from "@/lib/player/ad-feedback";
import {
  parseAdSkipRangesFromManifest,
  parseAdSkipRangesFromPlaylistTextWithSideChannel,
} from "@/lib/player/ad-tag-parser";
import {
  buildTimelineSampleIndex,
  cleanupTimelineSamples,
  type FragmentTimelineSample,
  getFragmentTimelineKey,
  getMediaBoundsFromFragment,
  getPlaylistBoundsFromFragment,
  type HlsFragmentLike,
  isFiniteNumber,
  mapSkipRangesToMediaTime,
  type TimelineMappedRange,
  type TimelineSampleIndex,
  upsertFragmentTimelineSample,
} from "@/lib/player/timeline-mapper";
import { cn, formatTime } from "@/lib/utils";

const SKIP_RANGE_REFRESH_INTERVAL_MS = 5_000;
const SKIP_RANGE_PRE_ROLL_SECONDS = 0.08;
const AD_DEBUG_PLAYLIST_EXCERPT_LIMIT = 12_000;
const AD_DEBUG_PLAYLIST_CONTEXT_MARGIN = 3000;
const AD_DEBUG_RECENT_EVENT_LIMIT = 50;
const AD_DEBUG_TIMELINE_SAMPLE_LIMIT = 80;
const AD_DEBUG_PLAYLIST_MARKERS = [
  "#EXT-X-ASSET",
  "#EXT-X-CUE",
  "#EXT-X-DATERANGE",
  "#EXT-X-SPLICEPOINT-SCTE35",
  "CUE-IN",
  "CUE-OUT",
  "SCTE35",
];

type VideoFrameCallback = (now: number, metadata: unknown) => void;
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};
type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "autoplay-blocked"
  | "fatal-error"
  | "unsupported";
type WebkitRemotePlaybackVideo = HTMLVideoElement & {
  webkitCurrentPlaybackTargetIsWireless?: boolean;
};

function findUnquotedComma(value: string, start: number) {
  let inQuote = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === "," && !inQuote) {
      return index;
    }
  }

  return -1;
}

function findPlaylistTimeIndex(playlistText: string, currentTime: number) {
  if (!Number.isFinite(currentTime) || currentTime < 0) return null;

  let elapsed = 0;
  let currentLineStart = 0;
  let pendingDuration: number | null = null;
  let nextLineStart = 0;

  while (nextLineStart <= playlistText.length) {
    const lineStart = nextLineStart;
    const lineEnd = playlistText.indexOf("\n", lineStart);
    const normalizedLineEnd = lineEnd === -1 ? playlistText.length : lineEnd;
    nextLineStart = normalizedLineEnd + 1;

    const line = playlistText.slice(lineStart, normalizedLineEnd);
    if (line.startsWith("#EXTINF:")) {
      const durationEnd = findUnquotedComma(line, "#EXTINF:".length);
      const durationText = line.slice(
        "#EXTINF:".length,
        durationEnd === -1 ? undefined : durationEnd,
      );
      const duration = Number.parseFloat(durationText);
      pendingDuration = Number.isFinite(duration) ? duration : null;
    } else if (pendingDuration !== null && line && !line.startsWith("#")) {
      const nextElapsed = elapsed + pendingDuration;
      if (currentTime >= elapsed && currentTime <= nextElapsed) {
        return currentLineStart;
      }
      elapsed = nextElapsed;
      pendingDuration = null;
    }

    currentLineStart = nextLineStart;
    if (lineEnd === -1) break;
  }

  return null;
}

function getPlaylistDebugExcerpt(
  playlistText: string | undefined,
  currentTime: number,
) {
  if (!playlistText || playlistText.length <= AD_DEBUG_PLAYLIST_EXCERPT_LIMIT) {
    return playlistText;
  }

  let centerIndex = findPlaylistTimeIndex(playlistText, currentTime);
  if (centerIndex === null) {
    centerIndex =
      AD_DEBUG_PLAYLIST_MARKERS.map((marker) => playlistText.indexOf(marker))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0] ?? null;
  }

  if (centerIndex === null) {
    return playlistText.slice(0, AD_DEBUG_PLAYLIST_EXCERPT_LIMIT);
  }

  const start = Math.max(0, centerIndex - AD_DEBUG_PLAYLIST_CONTEXT_MARGIN);
  return playlistText.slice(start, start + AD_DEBUG_PLAYLIST_EXCERPT_LIMIT);
}

function parseAspectRatio(value?: string | null) {
  if (!value) return null;

  const [rawWidth, rawHeight] = value
    .split("/")
    .map((part) => Number.parseFloat(part.trim()));
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) return null;
  if (rawWidth <= 0 || rawHeight <= 0) return null;

  return rawWidth / rawHeight;
}

interface VideoPlayerProps extends React.ComponentProps<"div"> {
  videoUrl: string;
  poster?: string;
  layoutAspectRatio?: string | null;
  mediaAspectRatio?: string | null;
  autoPlay?: boolean;
  autoSkip?: boolean;
  hlsResourcePromise: Promise<typeof import("hls.js").default>;
  initialProgress?: number;
  onProgressSync?: (time: number, duration: number, isBeacon?: boolean) => void;
  onVideoMetadata?: (metadata: { width: number; height: number }) => void;
  playbackProfile?: ContentKind;
  nextVideoUrl?: string;
  onEndedAdvance?: () => void;
  onAdSkip?: (snapshot: AdSkipDebugSnapshot) => void;
  dictionary: Messages;
}

export default function VideoPlayer({
  videoUrl,
  poster,
  layoutAspectRatio,
  mediaAspectRatio,
  autoPlay = false,
  autoSkip = true,
  hlsResourcePromise,
  initialProgress = 0,
  onProgressSync,
  onVideoMetadata,
  playbackProfile = "standard",
  nextVideoUrl,
  onEndedAdvance,
  onAdSkip,
  dictionary,
  ...props
}: VideoPlayerProps) {
  // Suspend until hls.js is loaded
  const Hls = React.use(hlsResourcePromise);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const skipRangesRef = React.useRef<{ start: number; end: number }[]>([]);
  const timelineSamplesRef = React.useRef<Map<string, FragmentTimelineSample>>(
    new Map(),
  );
  const timelineSampleIndexRef = React.useRef<TimelineSampleIndex>([]);
  const mappedSkipRangesRef = React.useRef<TimelineMappedRange[]>([]);
  const hlsEventsRef = React.useRef<AdSkipRuntimeEvent[]>([]);
  const hlsErrorsRef = React.useRef<AdSkipRuntimeEvent[]>([]);
  const isSeekingRef = React.useRef<boolean>(false);
  const isAutoSkippingRef = React.useRef<boolean>(false);
  const seekTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const lastSaveTimeRef = React.useRef<number>(0);
  const restoredProgressKeyRef = React.useRef<string | null>(null);
  const [playerStatus, setPlayerStatus] = React.useState<PlayerStatus>("idle");
  const [retryNonce, setRetryNonce] = React.useState(0);
  const containerRatio = parseAspectRatio(layoutAspectRatio) ?? 16 / 9;
  const mediaRatio = parseAspectRatio(mediaAspectRatio);
  const mediaBoxStyle = React.useMemo<React.CSSProperties>(() => {
    if (!mediaRatio) {
      return {
        height: "100%",
        width: "100%",
      };
    }

    if (mediaRatio > containerRatio) {
      return {
        height: `${(containerRatio / mediaRatio) * 100}%`,
        width: "100%",
      };
    }

    return {
      height: "100%",
      width: `${(mediaRatio / containerRatio) * 100}%`,
    };
  }, [containerRatio, mediaRatio]);

  const recordHlsEvent = React.useCallback(
    (name: string, details?: Record<string, unknown>) => {
      hlsEventsRef.current.push({
        at: new Date().toISOString(),
        details,
        name,
      });
      if (hlsEventsRef.current.length > AD_DEBUG_RECENT_EVENT_LIMIT) {
        hlsEventsRef.current.shift();
      }
    },
    [],
  );

  const recordHlsError = React.useCallback(
    (name: string, details?: Record<string, unknown>) => {
      hlsErrorsRef.current.push({
        at: new Date().toISOString(),
        details,
        name,
      });
      if (hlsErrorsRef.current.length > AD_DEBUG_RECENT_EVENT_LIMIT) {
        hlsErrorsRef.current.shift();
      }
    },
    [],
  );

  const getRecentTimelineSamples = React.useCallback(() => {
    return Array.from(timelineSamplesRef.current.values()).slice(
      -AD_DEBUG_TIMELINE_SAMPLE_LIMIT,
    );
  }, []);

  // Stable event-handler refs via useEffectEvent (React 19).
  // These always call the latest closure without appearing in
  // dependency arrays, so effects never re-subscribe on change.
  const saveProgress = React.useEffectEvent(() => {
    const video = videoRef.current;
    if (!video || !onProgressSync) return;

    try {
      const time = video.currentTime;
      const duration = video.duration;
      if (!Number.isNaN(time) && !Number.isNaN(duration)) {
        onProgressSync(time, duration, false);
      }
    } catch (err) {
      console.warn("[VideoPlayer] Failed to save progress:", err);
    }
  });

  const performSkip = React.useEffectEvent(
    (options?: { latestPlaylistText?: string; latestPlaylistUrl?: string }) => {
      const video = videoRef.current;
      if (!video || isSeekingRef.current || !autoSkip) return false;

      const currentTime = video.currentTime;
      for (const mappedRange of mappedSkipRangesRef.current) {
        const skipStart = video.paused
          ? mappedRange.start
          : Math.max(0, mappedRange.start - SKIP_RANGE_PRE_ROLL_SECONDS);
        if (currentTime >= skipStart && currentTime < mappedRange.end) {
          console.log(
            `[VideoPlayer] Skipping ad range: ${mappedRange.start.toFixed(1)} - ${mappedRange.end.toFixed(1)}${
              mappedRange.calibrated ? " (calibrated)" : ""
            }`,
          );
          isAutoSkippingRef.current = true;
          const nextTime = mappedRange.end;
          onAdSkip?.({
            autoSkip,
            createdAt: new Date().toISOString(),
            duration: Number.isFinite(video.duration) ? video.duration : null,
            hlsErrors: hlsErrorsRef.current.slice(),
            hlsEvents: hlsEventsRef.current.slice(),
            latestPlaylistTextExcerpt: getPlaylistDebugExcerpt(
              options?.latestPlaylistText,
              currentTime,
            ),
            latestPlaylistUrl: options?.latestPlaylistUrl,
            mappedRange,
            mappedSkipRanges: mappedSkipRangesRef.current.slice(),
            pageUrl: window.location.href,
            paused: video.paused,
            playbackProfile,
            playbackRate: video.playbackRate,
            rawSkipRanges: skipRangesRef.current.slice(),
            readyState: video.readyState,
            seek: {
              from: currentTime,
              to: nextTime,
            },
            timelineSamples: getRecentTimelineSamples(),
            userAgent:
              typeof navigator !== "undefined"
                ? navigator.userAgent
                : undefined,
            video: {
              currentSrc: video.currentSrc,
              height: video.videoHeight,
              src: video.src,
              width: video.videoWidth,
            },
            videoUrl,
          });
          video.currentTime = nextTime;
          return true;
        }
      }
      return false;
    },
  );

  const handleSeeking = React.useEffectEvent(() => {
    // If this seek was triggered by our auto-skip, don't block
    if (isAutoSkippingRef.current) {
      isAutoSkippingRef.current = false;
      return;
    }

    isSeekingRef.current = true;
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

    seekTimeoutRef.current = setTimeout(() => {
      isSeekingRef.current = false;
      // Check if we seeked into an ad and skip it immediately
      performSkip();
    }, 200);
  });

  const reportVideoMetadata = React.useEffectEvent(() => {
    const video = videoRef.current;
    if (!video || !onVideoMetadata) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width > 0 && height > 0) {
      onVideoMetadata({ width, height });
    }
  });

  const handleEndedAdvance = React.useEffectEvent(() => {
    onEndedAdvance?.();
  });

  const attemptPlay = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video) return false;

    try {
      await video.play();
      setPlayerStatus((status) =>
        status === "autoplay-blocked" || status === "loading"
          ? "ready"
          : status,
      );
      return true;
    } catch (err) {
      const errorName =
        err && typeof err === "object" && "name" in err ? err.name : undefined;
      if (errorName === "NotAllowedError") {
        setPlayerStatus("autoplay-blocked");
      } else {
        console.warn("[VideoPlayer] Failed to start playback:", err);
      }
      return false;
    }
  }, []);

  React.useEffect(() => {
    if (playbackProfile !== "short-drama" || !nextVideoUrl) return;

    const controller = new AbortController();
    const warmManifest = () => {
      fetch(nextVideoUrl, {
        cache: "force-cache",
        mode: "no-cors",
        signal: controller.signal,
      }).catch(() => {});
    };

    const warmManifestTimeout = window.setTimeout(warmManifest, 2500);

    return () => {
      controller.abort();
      window.clearTimeout(warmManifestTimeout);
    };
  }, [nextVideoUrl, playbackProfile]);

  // ── HLS setup ──────────────────────────────────────────────────────
  // Deps: videoUrl, autoPlay, autoSkip, and playbackProfile. Hls is a stable module
  // constructor, performSkip / handleSeeking are useEffectEvent
  // (excluded from deps by design).
  // biome-ignore lint/correctness/useExhaustiveDependencies: Hls is a stable module constructor; performSkip/handleSeeking are useEffectEvent
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: InstanceType<typeof Hls> | null = null;

    const supportsWebkitRemotePlayback =
      "webkitCurrentPlaybackTargetIsWireless" in video;

    const attachHls = () => {
      if (!hls) return;
      hls.attachMedia(video);
    };

    const addM3u8FallbackSource = () => {
      let resolvedUrl = videoUrl;
      try {
        resolvedUrl = new URL(videoUrl, window.location.href).href;
      } catch (err) {
        console.warn("[VideoPlayer] Failed to resolve video URL:", err);
      }
      const existingFallback = Array.from(video.children).find(
        (child) =>
          child instanceof HTMLSourceElement &&
          child.type === "application/x-mpegURL" &&
          child.src === resolvedUrl,
      );
      if (existingFallback) return;

      const airPlaySrc = document.createElement("source");
      airPlaySrc.type = "application/x-mpegURL";
      airPlaySrc.src = videoUrl;
      video.appendChild(airPlaySrc);
      video.disableRemotePlayback = false;
    };

    // Set up wireless playback (AirPlay) session management
    const setupWirelessListeners = () => {
      if (!hls || !supportsWebkitRemotePlayback) return;

      let resumptionInterval: ReturnType<typeof setInterval> | undefined;
      let currentPlaybackTargetIsWireless =
        (video as WebkitRemotePlaybackVideo)
          .webkitCurrentPlaybackTargetIsWireless ?? false;

      // Wireless (AirPlay) session: stop HLS.js streaming locally
      // and periodically sync the playback position for later resumption
      const stopHlsJsAndMonitorWirelessPlayback = () => {
        clearInterval(resumptionInterval);
        resumptionInterval = setInterval(() => {
          if (hls) {
            hls.config.startPosition = video.currentTime || -1;
          }
        }, 1000);
        // Stop streaming in web app when controlling remote playback
        hls?.stopLoad();
      };

      // Local session: detach then re-attach HLS.js to resume local playback
      const resumeLocalHlsJsPlayback = () => {
        clearInterval(resumptionInterval);
        if (!hls) return;
        hls.detachMedia();
        attachHls();
        addM3u8FallbackSource();
        hls.startLoad(hls.config.startPosition);
      };

      // On initial load, check if already in a wireless session
      // (e.g. page reload during AirPlay)
      if (currentPlaybackTargetIsWireless) {
        addM3u8FallbackSource();
        stopHlsJsAndMonitorWirelessPlayback();
      } else {
        attachHls();
        addM3u8FallbackSource();
      }

      // Handle remote playback session transitions
      const targetChanged = () => {
        const previousState = currentPlaybackTargetIsWireless;
        currentPlaybackTargetIsWireless =
          (video as WebkitRemotePlaybackVideo)
            .webkitCurrentPlaybackTargetIsWireless ?? false;

        if (currentPlaybackTargetIsWireless) {
          stopHlsJsAndMonitorWirelessPlayback();
        } else if (previousState) {
          resumeLocalHlsJsPlayback();
        }
      };

      const wirelessEventName = "webkitcurrentplaybacktargetiswirelesschanged";
      video.addEventListener(wirelessEventName, targetChanged);

      return () => {
        clearInterval(resumptionInterval);
        video.removeEventListener(wirelessEventName, targetChanged);
      };
    };

    let cleanupWirelessListeners: (() => void) | undefined;
    let nativeSkipRefreshInterval: ReturnType<typeof setInterval> | undefined;
    let hlsSkipRefreshInterval: ReturnType<typeof setInterval> | undefined;
    let nativeLoadedMetadataListener: (() => void) | undefined;
    let latestSkipRangeRequestId = 0;
    let latestPlaylistText: string | undefined;
    let latestPlaylistUrl: string | undefined;
    let latestPlaylistTimelineStart = 0;
    let deferredShortDramaSkipLoadStarted = false;
    const manifestParseController = new AbortController();
    skipRangesRef.current = [];
    timelineSamplesRef.current.clear();
    timelineSampleIndexRef.current = [];
    mappedSkipRangesRef.current = [];
    hlsEventsRef.current = [];
    hlsErrorsRef.current = [];
    setPlayerStatus("loading");

    const getNativeTimelineStart = () => {
      const seekable = video.seekable;
      if (seekable.length === 0) return 0;

      const start = seekable.start(0);
      return Number.isFinite(start) ? start : 0;
    };

    let skipWatchVideoFrameId: number | undefined;
    let skipWatchRafId: number | undefined;

    const clearHlsSkipRefreshInterval = () => {
      if (hlsSkipRefreshInterval) {
        clearInterval(hlsSkipRefreshInterval);
        hlsSkipRefreshInterval = undefined;
      }
    };

    const deferDestroyHls = () => {
      const currentHls = hls;
      hls = null;
      setTimeout(() => {
        currentHls?.destroy();
      }, 0);
    };

    const cancelSkipWatch = () => {
      const videoWithFrameCallback = video as VideoWithFrameCallback;
      if (skipWatchVideoFrameId !== undefined) {
        videoWithFrameCallback.cancelVideoFrameCallback?.(
          skipWatchVideoFrameId,
        );
        skipWatchVideoFrameId = undefined;
      }
      if (skipWatchRafId !== undefined) {
        cancelAnimationFrame(skipWatchRafId);
        skipWatchRafId = undefined;
      }
    };

    const queueSkipWatch = () => {
      if (
        !autoSkip ||
        video.paused ||
        video.ended ||
        skipWatchVideoFrameId !== undefined ||
        skipWatchRafId !== undefined
      ) {
        return;
      }

      const tick = () => {
        skipWatchVideoFrameId = undefined;
        skipWatchRafId = undefined;
        performSkip({
          latestPlaylistText,
          latestPlaylistUrl,
        });
        queueSkipWatch();
      };

      const videoWithFrameCallback = video as VideoWithFrameCallback;
      if (videoWithFrameCallback.requestVideoFrameCallback) {
        skipWatchVideoFrameId =
          videoWithFrameCallback.requestVideoFrameCallback(tick);
      } else {
        skipWatchRafId = requestAnimationFrame(tick);
      }
    };

    const refreshMappedSkipRanges = (options?: { rebuildIndex?: boolean }) => {
      if (options?.rebuildIndex ?? true) {
        timelineSampleIndexRef.current = buildTimelineSampleIndex(
          timelineSamplesRef.current,
        );
      } else {
        timelineSampleIndexRef.current = timelineSampleIndexRef.current.flatMap(
          (sample) => timelineSamplesRef.current.get(sample.key) ?? [],
        );
      }
      mappedSkipRangesRef.current = mapSkipRangesToMediaTime(
        timelineSampleIndexRef.current,
        skipRangesRef.current,
      );
    };

    const updateSkipRanges = async (options?: {
      playlistText?: string;
      playlistUrl?: string;
      timelineStart?: number;
    }) => {
      const requestId = ++latestSkipRangeRequestId;
      try {
        const timelineStart = options?.timelineStart;
        const playbackTime = video.currentTime;
        const ranges = options?.playlistText
          ? await parseAdSkipRangesFromPlaylistTextWithSideChannel(
              options.playlistText,
              {
                timelineStart,
                playlistUrl: options.playlistUrl ?? videoUrl,
                signal: manifestParseController.signal,
                playbackTime,
                enableMediaFingerprintProbe: true,
              },
            )
          : await parseAdSkipRangesFromManifest(videoUrl, {
              signal: manifestParseController.signal,
              timelineStart,
              playbackTime,
              enableMediaFingerprintProbe: true,
            });
        if (
          manifestParseController.signal.aborted ||
          requestId !== latestSkipRangeRequestId
        ) {
          return;
        }

        skipRangesRef.current = ranges;
        refreshMappedSkipRanges();

        performSkip();
        queueSkipWatch();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.warn("[VideoPlayer] Failed to parse ad tags:", err);
      }
    };

    const updateFragmentTimelineFromPlaylist = (
      fragments: HlsFragmentLike[],
    ) => {
      let changed = false;
      let indexChanged = false;
      for (const frag of fragments) {
        const bounds = getPlaylistBoundsFromFragment(frag);
        if (!bounds) continue;

        const result = upsertFragmentTimelineSample(
          timelineSamplesRef.current,
          {
            key: getFragmentTimelineKey(frag),
            cc: isFiniteNumber(frag.cc) ? frag.cc : 0,
            playlistStart: bounds.playlistStart,
            playlistEnd: bounds.playlistEnd,
          },
        );
        changed = result.changed || changed;
        indexChanged = result.indexChanged || indexChanged;
      }

      if (cleanupTimelineSamples(timelineSamplesRef.current)) {
        changed = true;
        indexChanged = true;
      }

      if (changed) {
        refreshMappedSkipRanges({ rebuildIndex: indexChanged });
      }
    };

    const updateFragmentTimelineFromMedia = (
      fragments: HlsFragmentLike | HlsFragmentLike[] | null | undefined,
    ) => {
      if (!fragments) return;

      const frags = Array.isArray(fragments) ? fragments : [fragments];
      let changed = false;
      let indexChanged = false;

      for (const frag of frags) {
        const mediaBounds = getMediaBoundsFromFragment(frag);
        if (!mediaBounds) continue;

        const key = getFragmentTimelineKey(frag);
        const existing = timelineSamplesRef.current.get(key);
        if (!existing) continue;

        const result = upsertFragmentTimelineSample(
          timelineSamplesRef.current,
          {
            key,
            cc: isFiniteNumber(frag.cc) ? frag.cc : 0,
            playlistStart: existing.playlistStart,
            playlistEnd: existing.playlistEnd,
            mediaStart: mediaBounds.mediaStart,
            mediaEnd: mediaBounds.mediaEnd,
          },
        );
        changed = result.changed || changed;
        indexChanged = result.indexChanged || indexChanged;
      }

      const cleanupChanged = cleanupTimelineSamples(timelineSamplesRef.current);
      if (changed || cleanupChanged) {
        refreshMappedSkipRanges({
          rebuildIndex: indexChanged || cleanupChanged,
        });
      }
    };

    let networkRecoveryAttempts = 0;
    let mediaRecoveryAttempts = 0;
    const resetRecoveryAttempts = () => {
      networkRecoveryAttempts = 0;
      mediaRecoveryAttempts = 0;
    };

    const initHls = () => {
      const supportsNativeHls = Boolean(
        video.canPlayType("application/vnd.apple.mpegurl"),
      );
      const supportsHlsJs = Hls.isSupported();
      const useNative = supportsNativeHls && (!autoSkip || !supportsHlsJs);

      const initialTime = initialProgress;

      if (useNative) {
        video.src = videoUrl;

        const onLoadedMetadata = () => {
          setPlayerStatus("ready");
          if (initialTime > 0) {
            video.currentTime = initialTime;
          }
          if (autoSkip) {
            void updateSkipRanges({
              timelineStart: getNativeTimelineStart(),
            });
            nativeSkipRefreshInterval = setInterval(() => {
              void updateSkipRanges({
                timelineStart: getNativeTimelineStart(),
              });
            }, SKIP_RANGE_REFRESH_INTERVAL_MS);
          }
          if (autoPlay) void attemptPlay();
        };

        nativeLoadedMetadataListener = onLoadedMetadata;
        video.addEventListener("loadedmetadata", onLoadedMetadata, {
          once: true,
        });
        video.load();
        return;
      }

      if (!supportsHlsJs) {
        setPlayerStatus("unsupported");
        return;
      }

      hls = new Hls({
        backBufferLength: playbackProfile === "short-drama" ? 15 : 60,
        capLevelOnFPSDrop: true,
        capLevelToPlayerSize: true,
        startPosition: initialTime,
        ...(playbackProfile === "short-drama"
          ? {
              fragLoadingMaxRetry: 2,
              manifestLoadingMaxRetry: 2,
              maxBufferLength: 12,
              maxMaxBufferLength: 30,
              startFragPrefetch: true,
            }
          : {}),
      });
      hls.on(Hls.Events.FRAG_CHANGED, (_event, data) => {
        resetRecoveryAttempts();
        updateFragmentTimelineFromMedia(data.frag);
        recordHlsEvent(Hls.Events.FRAG_CHANGED, {
          cc: data.frag?.cc,
          end: data.frag?.end,
          level: data.frag?.level,
          sn: data.frag?.sn,
          start: data.frag?.start,
          url: data.frag?.url,
        });
        performSkip({
          latestPlaylistText,
          latestPlaylistUrl,
        });
      });

      hls.on(Hls.Events.FRAG_BUFFERED, (_event, data) => {
        resetRecoveryAttempts();
        updateFragmentTimelineFromMedia(data.frag);
        recordHlsEvent(Hls.Events.FRAG_BUFFERED, {
          cc: data.frag?.cc,
          end: data.frag?.end,
          level: data.frag?.level,
          sn: data.frag?.sn,
          start: data.frag?.start,
          url: data.frag?.url,
        });
      });

      hls.on(Hls.Events.LEVEL_PTS_UPDATED, (_event, data) => {
        const fragments = Array.isArray(data.details?.fragments)
          ? data.details.fragments
          : data.frag
            ? [data.frag]
            : [];
        updateFragmentTimelineFromMedia(fragments);
        recordHlsEvent(Hls.Events.LEVEL_PTS_UPDATED, {
          fragmentCount: fragments.length,
        });
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        resetRecoveryAttempts();
        if (!autoSkip) return;

        const timelineStart = data.details.fragmentStart;
        latestPlaylistText = data.details.m3u8;
        latestPlaylistUrl = data.details.url;
        latestPlaylistTimelineStart = Number.isFinite(timelineStart)
          ? timelineStart
          : 0;
        recordHlsEvent(Hls.Events.LEVEL_LOADED, {
          fragmentCount: data.details.fragments.length,
          timelineStart: latestPlaylistTimelineStart,
          url: latestPlaylistUrl,
        });
        updateFragmentTimelineFromPlaylist(data.details.fragments);
        if (playbackProfile === "short-drama" && video.currentTime < 2) {
          return;
        }
        void updateSkipRanges({
          playlistText: latestPlaylistText,
          playlistUrl: latestPlaylistUrl,
          timelineStart: latestPlaylistTimelineStart,
        });

        hlsSkipRefreshInterval ??= setInterval(() => {
          if (!latestPlaylistText) return;
          void updateSkipRanges({
            playlistText: latestPlaylistText,
            playlistUrl: latestPlaylistUrl,
            timelineStart: latestPlaylistTimelineStart,
          });
        }, SKIP_RANGE_REFRESH_INTERVAL_MS);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        resetRecoveryAttempts();
        recordHlsEvent(Hls.Events.MANIFEST_PARSED);
        setPlayerStatus("ready");
        if (autoPlay) void attemptPlay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        recordHlsError(Hls.Events.ERROR, {
          details: data.details,
          error: data.error?.message,
          fatal: data.fatal,
          type: data.type,
        });
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              networkRecoveryAttempts += 1;
              if (networkRecoveryAttempts <= 2) {
                setPlayerStatus("loading");
                hls?.startLoad();
              } else {
                setPlayerStatus("fatal-error");
                hls?.stopLoad();
                clearHlsSkipRefreshInterval();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              mediaRecoveryAttempts += 1;
              if (mediaRecoveryAttempts <= 1) {
                setPlayerStatus("loading");
                hls?.recoverMediaError();
              } else {
                setPlayerStatus("fatal-error");
                deferDestroyHls();
                clearHlsSkipRefreshInterval();
              }
              break;
            default:
              setPlayerStatus("fatal-error");
              deferDestroyHls();
              clearHlsSkipRefreshInterval();
              break;
          }
        }
      });

      hls.loadSource(videoUrl);

      // Set up AirPlay wireless listeners (handles attachMedia + fallback source)
      if (supportsWebkitRemotePlayback) {
        cleanupWirelessListeners = setupWirelessListeners();
      } else {
        attachHls();
      }
    };
    const handleMediaError = () => {
      setPlayerStatus("fatal-error");
      if (nativeSkipRefreshInterval) {
        clearInterval(nativeSkipRefreshInterval);
        nativeSkipRefreshInterval = undefined;
      }
      clearHlsSkipRefreshInterval();
      deferDestroyHls();
    };
    const handlePlaying = () => {
      resetRecoveryAttempts();
      setPlayerStatus("ready");
    };

    video.addEventListener("seeking", handleSeeking, { passive: true });
    video.addEventListener("loadedmetadata", reportVideoMetadata);
    video.addEventListener("play", queueSkipWatch, { passive: true });
    video.addEventListener("playing", handlePlaying, { passive: true });
    video.addEventListener("pause", cancelSkipWatch);
    video.addEventListener("ended", cancelSkipWatch);
    video.addEventListener("error", handleMediaError);
    initHls();

    // Use timeupdate event (~4 fires/sec) instead of requestVideoFrameCallback
    // for significantly reduced CPU usage while maintaining skip accuracy
    const handleTimeUpdate = () => {
      if (autoSkip) {
        if (
          playbackProfile === "short-drama" &&
          !deferredShortDramaSkipLoadStarted &&
          skipRangesRef.current.length === 0 &&
          latestPlaylistText &&
          video.currentTime > 2
        ) {
          deferredShortDramaSkipLoadStarted = true;
          void updateSkipRanges({
            playlistText: latestPlaylistText,
            playlistUrl: latestPlaylistUrl,
            timelineStart: latestPlaylistTimelineStart,
          });
        }
        performSkip({
          latestPlaylistText,
          latestPlaylistUrl,
        });
      }

      const now = Date.now();
      if (now - lastSaveTimeRef.current > 5000) {
        lastSaveTimeRef.current = now;
        saveProgress();
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate, { passive: true });

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("loadedmetadata", reportVideoMetadata);
      video.removeEventListener("play", queueSkipWatch);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("pause", cancelSkipWatch);
      video.removeEventListener("ended", cancelSkipWatch);
      video.removeEventListener("error", handleMediaError);
      if (nativeLoadedMetadataListener) {
        video.removeEventListener(
          "loadedmetadata",
          nativeLoadedMetadataListener,
        );
      }
      cancelSkipWatch();
      cleanupWirelessListeners?.();
      clearInterval(nativeSkipRefreshInterval);
      clearInterval(hlsSkipRefreshInterval);
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      manifestParseController.abort();
      hls?.destroy();
      hls = null;
      for (const source of Array.from(video.querySelectorAll("source"))) {
        source.remove();
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [videoUrl, autoPlay, autoSkip, playbackProfile, retryNonce]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (initialProgress <= 0) {
      restoredProgressKeyRef.current = null;
      return;
    }
    if (!video) return;
    const restoreKey = `${videoUrl}:${initialProgress}`;
    if (restoredProgressKeyRef.current === restoreKey) return;

    const restorePlaybackPosition = () => {
      video.currentTime = initialProgress;
    };

    restoredProgressKeyRef.current = restoreKey;
    toast.info(
      new IntlMessageFormat(dictionary.watch["progress-restored"]).format({
        time: formatTime(initialProgress),
      }),
    );

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      restorePlaybackPosition();
      return;
    }

    video.addEventListener("loadedmetadata", restorePlaybackPosition, {
      once: true,
    });

    return () => {
      video.removeEventListener("loadedmetadata", restorePlaybackPosition);
    };
  }, [videoUrl, initialProgress, dictionary]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  // Mount-once: the handler reads videoRef at call time,
  // so no deps are needed.
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      // Ignore if user is typing in an input
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k": // Play/Pause
          e.preventDefault();
          if (video.paused) {
            void attemptPlay();
          } else {
            video.pause();
          }
          break;
        case "arrowleft": // Seek backward 5s
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "arrowright": // Seek forward 5s
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case "j": // Seek backward 10s
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "l": // Seek forward 10s
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case "arrowup": // Volume up
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "arrowdown": // Volume down
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "f": // Fullscreen
          e.preventDefault();
          if (!document.fullscreenElement) {
            video.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        case "m": // Mute
          e.preventDefault();
          video.muted = !video.muted;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [attemptPlay]);

  const handleRetryPlayback = React.useCallback(() => {
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  // ── Wake Lock & Visibility Changes ──────────────────────────────────────────────
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const requestWakeLock = async () => {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        try {
          if (!wakeLockRef.current) {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
          }
        } catch (err) {
          console.warn("Failed to request Wake Lock:", err);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {
          console.warn("Failed to release Wake Lock:", err);
        }
      }
    };

    // sendBeacon for pagehide / visibilitychange
    const beaconProgress = () => {
      const video = videoRef.current;
      if (!video || !onProgressSync) return;
      const time = video.currentTime;
      const duration = video.duration;
      if (!Number.isNaN(time) && !Number.isNaN(duration)) {
        onProgressSync(time, duration, true);
      }
    };

    const handlePlay = () => requestWakeLock();
    const handlePause = () => {
      releaseWakeLock();
      saveProgress();
    };
    const handleEnded = () => {
      releaseWakeLock();
      beaconProgress();
      handleEndedAdvance();
    };

    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === "visible" &&
        !video.paused &&
        !video.ended
      ) {
        await requestWakeLock();
      } else if (document.visibilityState === "hidden") {
        saveProgress();
        beaconProgress();
      }
    };

    const handlePageHide = () => {
      beaconProgress();
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      releaseWakeLock();
    };
  }, [onProgressSync]);

  return (
    <div
      {...props}
      className={cn(
        "relative rounded-lg overflow-hidden focus-visible:outline-none",
        props.className,
      )}
    >
      <div
        className="absolute inset-0 m-auto max-h-full max-w-full transition-[width,height] duration-300 ease-out"
        style={mediaBoxStyle}
      >
        <video
          ref={videoRef}
          className="block size-full object-contain object-center transition-opacity duration-500 [&:fullscreen]:outline-none"
          poster={poster}
          playsInline
          preload="metadata"
          controls
          autoPlay={autoPlay}
        >
          <track kind="captions" srcLang="en" />
          <p className="text-zinc-400 p-4">
            {dictionary.watch["browser-no-video"]}
            <a href={videoUrl} className="text-primary underline ml-1">
              {dictionary.watch["download-video"]}
            </a>
          </p>
        </video>
      </div>
      {playerStatus !== "idle" && playerStatus !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-4 text-center backdrop-blur-sm">
          {playerStatus === "loading" && (
            <div className="text-sm font-medium text-muted-foreground">
              {dictionary.watch["player-loading"]}
            </div>
          )}
          {playerStatus === "autoplay-blocked" && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void attemptPlay()}
            >
              <Play className="size-4" />
              {dictionary.watch["player-click-to-play"]}
            </button>
          )}
          {(playerStatus === "fatal-error" ||
            playerStatus === "unsupported") && (
            <div className="flex max-w-sm flex-col items-center gap-3">
              <p className="text-sm font-medium text-foreground">
                {playerStatus === "unsupported"
                  ? dictionary.watch["player-unsupported"]
                  : dictionary.watch["player-error"]}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {playerStatus === "fatal-error" && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={handleRetryPlayback}
                  >
                    <RotateCcw className="size-4" />
                    {dictionary.watch["player-retry"]}
                  </button>
                )}
                <a
                  href={videoUrl}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {dictionary.watch["download-video"]}
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
