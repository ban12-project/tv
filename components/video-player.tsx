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
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: HlsType | null = null;

    const initHls = () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) return;
      startTransition(async () => {
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
                  (context as unknown as { type: string }).type ===
                    "manifest" ||
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
      });
    };

    initHls();

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoUrl, autoPlay]);

  return (
    <div
      className={cn("relative bg-black rounded-lg overflow-hidden", className)}
    >
      <video
        ref={videoRef}
        className={cn(
          "w-full aspect-video transition-opacity duration-500",
          isPending ? "opacity-0" : "opacity-100",
        )}
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
