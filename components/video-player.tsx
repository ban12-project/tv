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
  const seekTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

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

      hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
      });

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
        // Threshold: Anything longer than 60 seconds is definitely content.
        // Also keep the single longest CC as content regardless of duration.
        let maxDuration = -1;
        let longestCC = -1;
        for (const ccStr in ccDurations) {
          const cc = Number.parseInt(ccStr, 10);
          if (ccDurations[cc] > maxDuration) {
            maxDuration = ccDurations[cc];
            longestCC = cc;
          }
        }

        const contentCCs = new Set<number>();
        contentCCs.add(longestCC); // Always keep the longest one

        for (const ccStr in ccDurations) {
          const cc = Number.parseInt(ccStr, 10);
          // If a part is longer than 60s, it's very likely a video part (not an ad)
          if (ccDurations[cc] > 60) {
            contentCCs.add(cc);
          }
        }

        // 3. Create skip ranges for fragments NOT in any content CC
        let currentRange: { start: number; end: number } | null = null;
        for (const frag of fragments) {
          if (!contentCCs.has(frag.cc)) {
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

        skipRangesRef.current = newSkipRanges;
        console.log(
          `[VideoPlayer] Identified content segments (CCs: ${Array.from(contentCCs).join(",")}). Skip ranges:`,
          newSkipRanges,
        );
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

    const handleTimeUpdate = () => {
      // If the user is manually seeking, don't interfere
      if (isSeekingRef.current) return;

      const currentTime = video.currentTime;
      for (const range of skipRangesRef.current) {
        if (currentTime >= range.start && currentTime < range.end) {
          console.log(
            `[VideoPlayer] Skipping ad range: ${range.start.toFixed(1)} - ${range.end.toFixed(1)}`,
          );
          video.currentTime = range.end;
          break;
        }
      }
    };

    const handleSeeking = () => {
      isSeekingRef.current = true;
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

      // Give the user a 1s grace period after seeking before auto-skipping resumes
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
      }, 1000);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeking", handleSeeking);
    initHls();

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeking", handleSeeking);
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      hls?.destroy();
    };
  }, [videoUrl, autoPlay]);

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
