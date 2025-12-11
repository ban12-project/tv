"use client";

import type HlsType from "hls.js"; // Type-only import
import type { HlsConfig, Loader, LoaderContext } from "hls.js";
import {
  Airplay,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/get-dictionary";
import { cn } from "@/lib/utils";

interface WebKitHTMLVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker(): void;
  webkitCurrentPlaybackTargetIsWireless: boolean;
  webkitEnterFullscreen?(): void;
  webkitExitFullscreen?(): void;
  webkitDisplayingFullscreen?: boolean;
  webkitSupportsFullscreen?: boolean;
}

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

function formatTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({
  videoUrl,
  poster,
  autoPlay = false,
  title,
  dictionary: dict,
  className,
}: VideoPlayerProps) {
  const videoTitle = title || dict["video-player"]["default-title"];
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false); // Default hidden on mobile until tap
  const [isPending, startTransition] = useTransition();
  const [isAirPlayAvailable, setIsAirPlayAvailable] = useState(false);

  // Keep track of the last time we updated the state to avoid flooding react
  const lastStateUpdateTime = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: HlsType | null = null;

    const handleFullscreenChange = () => {
      const isDocFullscreen =
        !!document.fullscreenElement ||
        // @ts-expect-error - Vendor prefix
        !!document.webkitFullscreenElement ||
        // @ts-expect-error - Vendor prefix
        !!document.mozFullScreenElement ||
        // @ts-expect-error - Vendor prefix
        !!document.msFullscreenElement;

      setIsFullscreen(isDocFullscreen);
    };

    const handleWebkitEndFullscreen = () => {
      setIsFullscreen(false);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);
    video.addEventListener("webkitendfullscreen", handleWebkitEndFullscreen);

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      const vidTime = video.currentTime;
      const vidDuration = video.duration || 1;

      if (progressBarRef.current) {
        const percent = (vidTime / vidDuration) * 100;
        progressBarRef.current.style.width = `${percent}%`;
      }

      const floorTime = Math.floor(vidTime);
      if (floorTime !== lastStateUpdateTime.current) {
        setCurrentTime(floorTime);
        lastStateUpdateTime.current = floorTime;
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleAirPlayAvailability = (
      event: Event & { availability: "available" | "not-available" },
    ) => {
      setIsAirPlayAvailable(event.availability === "available");
    };

    if (
      (video as unknown as WebKitHTMLVideoElement)
        .webkitShowPlaybackTargetPicker
    ) {
      video.addEventListener(
        "webkitplaybacktargetavailabilitychanged",
        handleAirPlayAvailability as EventListener,
      );
    }

    const initHls = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) return;
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) return toast("HLS is not supported");

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

    startTransition(async () => {
      await initHls();
    });

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      if (
        (video as unknown as WebKitHTMLVideoElement)
          .webkitShowPlaybackTargetPicker
      ) {
        video.removeEventListener(
          "webkitplaybacktargetavailabilitychanged",
          handleAirPlayAvailability as EventListener,
        );
      }
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange,
      );
      video.removeEventListener(
        "webkitendfullscreen",
        handleWebkitEndFullscreen,
      );
    };
  }, [videoUrl, autoPlay]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    const progressBar = progressContainerRef.current;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    video.currentTime = newTime;

    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${clickPosition * 100}%`;
    }
    setCurrentTime(newTime);
    lastStateUpdateTime.current = Math.floor(newTime);
  };

  const handleProgressKeyboard = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const seekAmount = e.key === "ArrowRight" ? 5 : -5;
      const newTime = Math.max(
        0,
        Math.min(duration, video.currentTime + seekAmount),
      );
      video.currentTime = newTime;
      e.preventDefault();

      if (progressBarRef.current && duration > 0) {
        progressBarRef.current.style.width = `${(newTime / duration) * 100}%`;
      }
      setCurrentTime(newTime);
      lastStateUpdateTime.current = Math.floor(newTime);
    }
  };

  const skip = (seconds: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(
      0,
      Math.min(duration, video.currentTime + seconds),
    );
    video.currentTime = newTime;

    if (progressBarRef.current && duration > 0) {
      progressBarRef.current.style.width = `${(newTime / duration) * 100}%`;
    }
    setCurrentTime(newTime);
    lastStateUpdateTime.current = Math.floor(newTime);
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const container = videoRef.current?.parentElement;
    const video = videoRef.current as unknown as WebKitHTMLVideoElement;
    if (!container || !video) return;

    if (document.fullscreenEnabled) {
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch((err) => {
          console.error(
            `Error attempting to enable fullscreen: ${err.message}`,
          );
        });
      } else {
        document.exitFullscreen();
      }
    } else if (video.webkitSupportsFullscreen) {
      if (video.webkitDisplayingFullscreen) {
        video.webkitExitFullscreen?.();
      } else {
        video.webkitEnterFullscreen?.();
      }
    }
  };

  const handleAirPlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current as unknown as WebKitHTMLVideoElement;
    if (video?.webkitShowPlaybackTargetPicker) {
      video.webkitShowPlaybackTargetPicker();
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest('[role="progressbar"]')
    ) {
      return;
    }
    setShowControls((prev) => !prev);
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === "f") {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    }
  };

  return (
    <section
      className={cn(
        "relative bg-black rounded-lg overflow-hidden group select-none touch-none focus:outline-hidden",
        className,
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={handleContainerClick}
      onKeyDown={handleContainerKeyDown}
      aria-label="Video Player"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Interactive container for keyboard shortcuts
      tabIndex={0}
    >
      {/* Video Element */}
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
      >
        <track kind="captions" srcLang="en" />
        <p className="text-white p-4">
          {dict["video-player"]["browser-not-support"]}
          <a href={videoUrl} className="text-blue-400 underline ml-1">
            {dict["video-player"]["download-video"]}
          </a>
        </p>
      </video>

      {/* BIG Play Button Overlay (when paused and not loading) */}
      {!isPlaying && !isPending && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Button
            variant="secondary"
            size="icon"
            onClick={togglePlay}
            className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md pointer-events-auto transition-all transform hover:scale-105"
          >
            <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
          </Button>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-4 sm:p-6 transition-[opacity,translate] duration-300 will-change-[opacity,translate]",
          showControls || !isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none",
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()} // Added keyboard handler
        role="toolbar" // Changed to toolbar
        aria-label="Video Controls"
      >
        {/* Video Title */}
        <h3 className="text-white text-base sm:text-lg font-semibold mb-2 sm:mb-4 drop-shadow-md truncate max-w-[80%]">
          {videoTitle}
        </h3>

        {/* Progress Bar */}
        <div
          ref={progressContainerRef}
          className="sm:mb-4 group/progress relative py-2 cursor-pointer touch-none"
          role="slider" // Changed to slider
          aria-label="Seek Slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={duration ? (currentTime / duration) * 100 : 0}
          onClick={handleProgressClick}
          onKeyUp={handleProgressKeyboard}
          tabIndex={0}
        >
          {/* Touch area specifically for mobile seeking */}
          <div className="h-1 w-full bg-white/30 rounded-full overflow-hidden backdrop-blur-sm group-hover/progress:h-1.5 transition-all">
            <div
              ref={progressBarRef}
              className="h-full bg-indigo-500 rounded-full relative"
              style={{ width: `0%` }}
            >
              {/* Thumb */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-white/10 hover:text-white transition-colors h-10 w-10 sm:h-9 sm:w-9"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-5 sm:h-5" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 sm:w-5 sm:h-5" fill="currentColor" />
              )}
            </Button>

            {/* Skip Back */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => skip(-10, e)}
              className="text-white hover:bg-white/10 hover:text-white transition-colors h-10 w-10 sm:h-9 sm:w-9"
            >
              <RotateCcw className="w-5 h-5 sm:w-4 sm:h-4" />
            </Button>

            {/* Skip Forward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => skip(10, e)}
              className="text-white hover:bg-white/10 hover:text-white transition-colors h-10 w-10 sm:h-9 sm:w-9"
            >
              <SkipForward className="w-5 h-5 sm:w-4 sm:h-4" />
            </Button>

            {/* Volume - Hidden on small mobile */}
            <div className="hidden sm:flex items-center space-x-2 group/volume">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/10 hover:text-white transition-colors h-9 w-9"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>

            {/* Time Display */}
            <div className="text-white/80 text-xs sm:text-sm font-medium font-mono ml-2 pointer-events-none select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center space-x-2">
            {/* AirPlay */}
            {isAirPlayAvailable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAirPlay}
                className="text-white hover:bg-white/10 hover:text-white transition-colors h-10 w-10 sm:h-9 sm:w-9"
              >
                <Airplay className="w-5 h-5" />
              </Button>
            )}

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/10 hover:text-white transition-colors h-10 w-10 sm:h-9 sm:w-9"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
