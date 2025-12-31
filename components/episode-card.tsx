"use client";

import HoverPrefetchLink from "@/components/hover-prefetch-link";
import { cn } from "@/lib/utils";

interface EpisodeCardProps
  extends React.ComponentProps<typeof HoverPrefetchLink> {
  index: number;
  isActive: boolean;
}

export function EpisodeCard({ index, isActive, ...props }: EpisodeCardProps) {
  return (
    <HoverPrefetchLink
      {...props}
      className={cn(
        "flex items-center justify-center w-12 h-12 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {index + 1}
    </HoverPrefetchLink>
  );
}
