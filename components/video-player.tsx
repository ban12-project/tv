"use client";

import IntlMessageFormat from "intl-messageformat";
import * as React from "react";
import { toast } from "sonner";
import type { Messages } from "@/get-dictionary";
import type { ContentKind } from "@/lib/adapters/types";
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

type VideoFrameCallback = (now: number, metadata: unknown) => void;
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

interface VideoPlayerProps extends React.ComponentProps<"div"> {
  videoUrl: string;
  poster?: string;
  autoPlay?: boolean;
  autoSkip?: boolean;
  hlsResourcePromise: Promise<typeof import("hls.js").default>;
  initialProgress?: number;
  onProgressSync?: (time: number, duration: number, isBeacon?: boolean) => void;
  onVideoMetadata?: (metadata: { width: number; height: number }) => void;
  playbackProfile?: ContentKind;
  nextVideoUrl?: string;
  onEndedAdvance?: () => void;
  dictionary: Messages;
}

export default function VideoPlayer({
  videoUrl,
  poster,
  autoPlay = false,
  autoSkip = true,
  hlsResourcePromise,
  initialProgress = 0,
  onProgressSync,
  onVideoMetadata,
  playbackProfile = "standard",
  nextVideoUrl,
  onEndedAdvance,
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
  const isSeekingRef = React.useRef<boolean>(false);
  const isAutoSkippingRef = React.useRef<boolean>(false);
  const seekTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const lastSaveTimeRef = React.useRef<number>(0);
  const restoredProgressKeyRef = React.useRef<string | null>(null);

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

  const performSkip = React.useEffectEvent(() => {
    const video = videoRef.current;
    if (!video || isSeekingRef.current) return false;

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
        video.currentTime = mappedRange.end;
        return true;
      }
    }
    return false;
  });

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

    // Attach HLS.js to the video element and add a fallback <source>
    // for AirPlay/remote playback compatibility
    const attachHlsAndAddM3u8FallbackSource = () => {
      if (!hls) return;
      // attachMedia will create the first ManagedMediaSource <source> child
      hls.attachMedia(video);

      // Add the fallback <source> child to allow remote playback of the m3u8 source
      const airPlaySrc = document.createElement("source");
      airPlaySrc.type = "application/x-mpegURL";
      airPlaySrc.src = videoUrl;
      video.appendChild(airPlaySrc);
      video.disableRemotePlayback = false;
    };

    // Set up wireless playback (AirPlay) session management
    const setupWirelessListeners = () => {
      if (!hls) return;

      let resumptionInterval: ReturnType<typeof setInterval> | undefined;
      let currentPlaybackTargetIsWireless =
        (
          video as HTMLVideoElement & {
            webkitCurrentPlaybackTargetIsWireless?: boolean;
          }
        ).webkitCurrentPlaybackTargetIsWireless ?? false;

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
        attachHlsAndAddM3u8FallbackSource();
        hls.startLoad(hls.config.startPosition);
      };

      // On initial load, check if already in a wireless session
      // (e.g. page reload during AirPlay)
      if (currentPlaybackTargetIsWireless) {
        stopHlsJsAndMonitorWirelessPlayback();
      } else {
        attachHlsAndAddM3u8FallbackSource();
      }

      // Handle remote playback session transitions
      const targetChanged = () => {
        const previousState = currentPlaybackTargetIsWireless;
        currentPlaybackTargetIsWireless =
          (
            video as HTMLVideoElement & {
              webkitCurrentPlaybackTargetIsWireless?: boolean;
            }
          ).webkitCurrentPlaybackTargetIsWireless ?? false;

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

    const getNativeTimelineStart = () => {
      const seekable = video.seekable;
      if (seekable.length === 0) return 0;

      const start = seekable.start(0);
      return Number.isFinite(start) ? start : 0;
    };

    let skipWatchVideoFrameId: number | undefined;
    let skipWatchRafId: number | undefined;

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
        performSkip();
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
                enableResolutionProbe: true,
              },
            )
          : await parseAdSkipRangesFromManifest(videoUrl, {
              signal: manifestParseController.signal,
              timelineStart,
              playbackTime,
              enableResolutionProbe: true,
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

    const initHls = () => {
      const useNative = !autoSkip || !Hls.isSupported();

      const initialTime = initialProgress;

      if (useNative) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = videoUrl;

          const onLoadedMetadata = () => {
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
            if (autoPlay) video.play().catch(() => {});
          };

          video.addEventListener("loadedmetadata", onLoadedMetadata, {
            once: true,
          });
          video.load();
        }
        return;
      }

      hls = new Hls({
        startPosition: initialTime,
        ...(playbackProfile === "short-drama"
          ? {
              backBufferLength: 15,
              fragLoadingMaxRetry: 2,
              manifestLoadingMaxRetry: 2,
              maxBufferLength: 12,
              maxMaxBufferLength: 30,
              startFragPrefetch: true,
            }
          : {}),
      });

      hls.on(Hls.Events.FRAG_CHANGED, (_event, data) => {
        updateFragmentTimelineFromMedia(data.frag);
        performSkip();
      });

      hls.on(Hls.Events.FRAG_BUFFERED, (_event, data) => {
        updateFragmentTimelineFromMedia(data.frag);
      });

      hls.on(Hls.Events.LEVEL_PTS_UPDATED, (_event, data) => {
        const fragments = Array.isArray(data.details?.fragments)
          ? data.details.fragments
          : data.frag
            ? [data.frag]
            : [];
        updateFragmentTimelineFromMedia(fragments);
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (!autoSkip) return;

        const timelineStart = data.details.fragmentStart;
        latestPlaylistText = data.details.m3u8;
        latestPlaylistUrl = data.details.url;
        latestPlaylistTimelineStart = Number.isFinite(timelineStart)
          ? timelineStart
          : 0;
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
        if (autoPlay) video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              break;
          }
        }
      });

      hls.loadSource(videoUrl);

      // Set up AirPlay wireless listeners (handles attachMedia + fallback source)
      cleanupWirelessListeners = setupWirelessListeners();
    };

    video.addEventListener("seeking", handleSeeking, { passive: true });
    video.addEventListener("loadedmetadata", reportVideoMetadata);
    video.addEventListener("play", queueSkipWatch, { passive: true });
    video.addEventListener("pause", cancelSkipWatch);
    video.addEventListener("ended", cancelSkipWatch);
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
        performSkip();
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
      video.removeEventListener("pause", cancelSkipWatch);
      video.removeEventListener("ended", cancelSkipWatch);
      cancelSkipWatch();
      cleanupWirelessListeners?.();
      clearInterval(nativeSkipRefreshInterval);
      clearInterval(hlsSkipRefreshInterval);
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      manifestParseController.abort();
      hls?.destroy();
    };
  }, [videoUrl, autoPlay, autoSkip, playbackProfile]);

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
            video.play().catch(() => {});
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
      className={cn("relative rounded-lg overflow-hidden", props.className)}
    >
      <video
        ref={videoRef}
        className="size-full transition-opacity duration-500"
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
  );
}
