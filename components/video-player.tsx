"use client";

import type HlsType from "hls.js"; // Type-only import
import type { HlsConfig, Loader, LoaderContext } from "hls.js";
import * as React from "react";
import { toast } from "sonner";
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

// Placeholder for ad filtering logic
function filterAdsFromM3U8(content: string): string {
  // TODO: Implement actual ad filtering logic based on specific requirements
  // For now, return content as is
  return content;
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
      if (video.canPlayType("application/vnd.apple.mpegurl")) return;
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) {
        toast("HLS is not supported");
        return;
      }

      try {
        class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
          constructor(config: HlsConfig) {
            super(config);
            const load = this.load.bind(this);
            this.load = (context, config, callbacks) => {
              if (
                (context as unknown as { type: string }).type === "manifest" ||
                (context as unknown as { type: string }).type === "level"
              ) {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = (
                  response,
                  stats,
                  context,
                  networkDetails,
                ) => {
                  if (response.data && typeof response.data === "string") {
                    response.data = filterAdsFromM3U8(response.data);
                  }
                  return onSuccess(response, stats, context, networkDetails);
                };
              }
              load(context, config, callbacks);
            };
          }
        }

        hls = new Hls({
          loader: CustomHlsJsLoader as unknown as new (
            conf: HlsConfig,
          ) => Loader<LoaderContext>,
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
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
                if (hls) {
                  hls.destroy();
                }
                break;
            }
          }
        });
      } catch (error) {
        toast.error(`Failed to load Hls.js ${error}`);
      }
    };

    initHls();

    return () => {
      if (hls) {
        hls.destroy();
      }
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
        src={videoUrl}
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
