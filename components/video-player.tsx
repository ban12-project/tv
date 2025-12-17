"use client";

import type HlsType from "hls.js"; // Type-only import
import type { HlsConfig } from "hls.js";
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

function filterAdsFromM3U8(content: string): string {
  // #EXT-X-DISCONTINUITY - https://developer.apple.com/documentation/http-live-streaming/incorporating-ads-into-a-playlist
  return content
    .split("\n")
    .filter((line) => !line.includes("#EXT-X-DISCONTINUITY"))
    .join("\n");
}

export default function VideoPlayer({
  videoUrl,
  poster,
  autoPlay = false,
  className,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

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

      class CustomLoader extends Hls.DefaultConfig.loader {
        constructor(config: HlsConfig) {
          super(config);
          const load = this.load.bind(this);
          this.load = (context, config, callback) => {
            const { type } = context as unknown as {
              type: "manifest" | "level";
            };
            if (type === "manifest" || type === "level") {
              const onSuccess = callback.onSuccess;
              callback.onSuccess = (
                response,
                stats,
                context,
                networkDetails,
              ) => {
                if (typeof response.data === "string") {
                  response.data = filterAdsFromM3U8(response.data);
                }
                return onSuccess(response, stats, context, networkDetails);
              };
            }
            load(context, config, callback);
          };
        }
      }

      hls = new Hls({
        loader: CustomLoader,
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

    initHls();

    return () => {
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
