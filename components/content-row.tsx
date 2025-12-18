"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import type { Video } from "@/lib/adapters/types";
import { VideoCard } from "./video-card";

interface ContentRowProps {
  title: string;
  videos: Video[];
}

export function ContentRow({ title, videos }: ContentRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const scrollAmount = direction === "left" ? -800 : 800;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!videos.length) return null;

  return (
    <section className="py-8 px-6 md:px-8 lg:px-10 relative group/section">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          className="text-sm font-semibold text-neutral-400 group-hover/section:text-white transition-colors duration-200"
        >
          See All
        </button>
      </div>

      <div className="relative group/slider">
        {/* Left Arrow */}
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 backdrop-blur-md rounded-full text-white opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300 -ml-5 hover:bg-white/20"
          aria-label="Scroll left"
        >
          <ChevronLeft size={24} />
        </button>

        <div
          ref={containerRef}
          className="flex gap-6 overflow-x-auto pb-8 pt-2 scrollbar-hide snap-x"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map((video) => (
            <VideoCard
              key={video.id + video.title}
              video={video}
              width={400}
              className="snap-start"
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 backdrop-blur-md rounded-full text-white opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300 -mr-5 hover:bg-white/20"
          aria-label="Scroll right"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </section>
  );
}
