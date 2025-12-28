"use client";

import type HlsType from "hls.js"; // Type-only import
import * as React from "react";
import type { Messages } from "@/get-dictionary";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  videoUrl: string;
  poster?: string;
  autoPlay?: boolean;
  title?: string;
  dictionary: Messages;
  className?: string;
}

export default function VideoPlayer({
  videoUrl,
  poster,
  autoPlay = false,
  className,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const skipRangesRef = React.useRef<{ start: number; end: number }[]>([]);
  const isSeekingRef = React.useRef<boolean>(false);
  const isAutoSkippingRef = React.useRef<boolean>(false);
  const seekTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const performSkip = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || isSeekingRef.current) return false;

    const currentTime = video.currentTime;
    for (const range of skipRangesRef.current) {
      if (currentTime >= range.start && currentTime < range.end) {
        console.log(
          `[VideoPlayer] Skipping ad range: ${range.start.toFixed(1)} - ${range.end.toFixed(1)}`,
        );
        isAutoSkippingRef.current = true;
        video.currentTime = range.end;
        return true;
      }
    }
    return false;
  }, []);

  const handleSeeking = React.useCallback(() => {
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
  }, [performSkip]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: HlsType | null = null;
    const initHls = async () => {
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = videoUrl;
          video.load();
          if (autoPlay) video.play().catch(() => {});
        }
        return;
      }

      hls = new Hls();

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        const fragments = data.details.fragments;
        if (fragments.length === 0) return;

        const newSkipRanges: { start: number; end: number }[] = [];

        // 1. Calculate total duration for each continuity counter (cc) group
        const ccDurations: Record<number, number> = {};
        for (const frag of fragments) {
          ccDurations[frag.cc] = (ccDurations[frag.cc] || 0) + frag.duration;
        }

        // 2. Identify "Content" CCs vs "Ad" CCs
        // Strategy: Default all to Content. Treat Discontinuities as toggles.
        // Assumes: Content -> Ad -> Content -> Ad, etc.
        // Even CCs (0, 2, 4...) = Content
        // Odd CCs (1, 3, 5...) = Ads
        const uniqueCCs = Array.from(new Set(fragments.map((f) => f.cc))).sort(
          (a, b) => a - b,
        );

        const contentCCs = new Set<number>();
        uniqueCCs.forEach((cc, index) => {
          if (index % 2 === 0) {
            contentCCs.add(cc);
          }
        });

        // 3. Create skip ranges for fragments NOT in any content CC
        let currentRange: { start: number; end: number } | null = null;
        let totalAdDuration = 0;
        const totalVideoDuration = Object.values(ccDurations).reduce(
          (a, b) => a + b,
          0,
        );

        for (const frag of fragments) {
          if (!contentCCs.has(frag.cc)) {
            totalAdDuration += frag.duration;
            if (!currentRange) {
              currentRange = {
                start: frag.start,
                end: frag.start + frag.duration,
              };
            } else {
              currentRange.end = frag.start + frag.duration;
            }
          } else {
            if (currentRange) {
              newSkipRanges.push(currentRange);
              currentRange = null;
            }
          }
        }
        if (currentRange) {
          newSkipRanges.push(currentRange);
        }

        // SAFETY CHECK: If detected "ads" take up more than 20% of the video,
        // it likely means our heuristic failed (e.g. content is fragmented into small CCs).
        // In this case, it's safer to disable skipping than to skip content.
        // We only apply this check if the video is reasonably long (> 5 minutes) to avoid edge cases in short clips.
        const adRatio =
          totalVideoDuration > 0 ? totalAdDuration / totalVideoDuration : 0;
        const isFragmentationLikely = totalVideoDuration > 300 && adRatio > 0.2;

        if (isFragmentationLikely) {
          console.warn(
            `[VideoPlayer] Ad detection heuristic fallback triggered. Ad ratio: ${(
              adRatio * 100
            ).toFixed(1)}%. Disabling auto-skip to protect content.`,
          );
          skipRangesRef.current = [];
        } else {
          skipRangesRef.current = newSkipRanges;
          console.log(
            `[VideoPlayer] Identified content segments (CCs: ${Array.from(
              contentCCs,
            ).join(",")}). Skip ranges:`,
            newSkipRanges,
          );
        }

        // Check immediately after ranges are identified
        performSkip();
      });

      hls.on(Hls.Events.FRAG_CHANGED, () => {
        performSkip();
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
      hls.attachMedia(video);
    };

    video.addEventListener("seeking", handleSeeking);
    initHls();

    let frameId: number;
    const loop = () => {
      if (!video.paused && !video.ended) {
        performSkip();
      }
      frameId = video.requestVideoFrameCallback(loop);
    };
    frameId = video.requestVideoFrameCallback(loop);

    return () => {
      video.cancelVideoFrameCallback(frameId);
      video.removeEventListener("seeking", handleSeeking);
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      hls?.destroy();
    };
  }, [videoUrl, autoPlay, handleSeeking, performSkip]);

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
          handleSeeking();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "arrowright": // Seek forward 5s
          e.preventDefault();
          handleSeeking();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case "j": // Seek backward 10s
          e.preventDefault();
          handleSeeking();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "l": // Seek forward 10s
          e.preventDefault();
          handleSeeking();
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
  }, [handleSeeking]);

  return (
    <div
      className={cn("relative bg-black rounded-lg overflow-hidden", className)}
    >
      <video
        ref={videoRef}
        className="w-full aspect-video transition-opacity duration-500"
        poster={poster}
        playsInline
        preload="metadata"
        controls
        autoPlay={autoPlay}
      >
        <track kind="captions" srcLang="en" />
        <p className="text-white p-4">
          Browser does not support video.
          <a href={videoUrl} className="text-blue-400 underline ml-1">
            Download Video
          </a>
        </p>
      </video>
    </div>
  );
}
