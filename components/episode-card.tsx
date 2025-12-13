"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useIntersectionObserver } from "usehooks-ts";
import Link from "@/components/link";
import type { Episode, Video } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

interface EpisodeCardProps {
  episode: Episode;
  index: number;
  isActive: boolean;
  video: Video;
  linkHref: string;
}

export function EpisodeCard({
  episode,
  index,
  isActive,
  video,
  linkHref,
}: EpisodeCardProps) {
  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0.5,
  });
  const isVisible = !!isIntersecting;

  const [details, setDetails] = useState<{
    duration?: string;
    description?: string;
  }>({
    duration: video.duration, // Fallback initial value
    description: undefined,
  });

  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (isVisible && !hasFetched) {
      setHasFetched(true);

      // Simulate API call or fetch real data here if available
      // For now, we simulate a small delay to show the mechanism
      const timer = setTimeout(() => {
        setDetails({
          duration: video.duration || "24 min",
          description: video.description, // In real scenario: fetch specific ep description
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isVisible, hasFetched, video]);

  return (
    <div ref={ref} className="flex-none w-72 md:w-80 flex flex-col gap-2 group">
      <Link href={linkHref} className="isolate">
        <div
          className={cn(
            "aspect-video w-full relative rounded-lg overflow-hidden bg-neutral-800 border-2 transition-all",
            isActive
              ? "border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              : "border-transparent group-hover:border-white/50",
          )}
        >
          {/* Use generic show image as fallback for episode thumbnail */}
          <Image
            src={video.backgroundImage || video.image}
            alt={episode.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
          />

          {/* Play Icon Overlay */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
              isActive ? "opacity-0" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <div className="w-0 h-0 border-t-8 border-t-transparent border-l-14 border-l-white border-b-8 border-b-transparent ml-1" />
            </div>
          </div>

          {/* Progress bar simulation */}
          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div className="h-full bg-white w-full" />
            </div>
          )}
        </div>

        <div className="flex flex-col px-1 mt-2">
          <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
            {index + 1}. {episode.name}
          </span>
          <span className="text-xs text-gray-500 truncate min-h-4">
            {details.duration ? (
              details.duration
            ) : (
              <span className="animate-pulse bg-white/10 w-12 h-3 rounded inline-block" />
            )}
          </span>

          <p className="text-xs text-gray-400 line-clamp-2 mt-1 min-h-8">
            {/* Show description only if fetched, otherwise maybe skeleton or hidden */}
            {hasFetched ? (
              details.description || video.description
            ) : (
              <span className="flex flex-col gap-1 mt-1">
                <span className="animate-pulse bg-white/10 w-full h-2 rounded block" />
                <span className="animate-pulse bg-white/10 w-2/3 h-2 rounded block" />
              </span>
            )}
          </p>
        </div>
      </Link>
    </div>
  );
}
