"use client";

import HoverPrefetchLink from "@/components/hover-prefetch-link";
import { cn } from "@/lib/utils";

interface EpisodeCardProps {
  index: number;
  isActive: boolean;
  linkHref: string;
}

export function EpisodeCard({ index, isActive, linkHref }: EpisodeCardProps) {
  return (
    <HoverPrefetchLink
      href={linkHref}
      className={cn(
        "flex items-center justify-center w-12 h-12 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-white text-black"
          : "bg-neutral-800 text-gray-300 hover:bg-neutral-700 hover:text-white",
      )}
    >
      {index + 1}
    </HoverPrefetchLink>
  );
}
