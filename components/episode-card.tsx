"use client";

import HoverPrefetchLink from "@/components/hover-prefetch-link";
import { cn } from "@/lib/utils";

interface EpisodeCardProps
  extends Omit<React.ComponentProps<typeof HoverPrefetchLink>, "onClick"> {
  index: number;
  isActive: boolean;
  dense?: boolean;
  onClick?: (index: number) => void;
}

export function EpisodeCard({
  index,
  isActive,
  dense = false,
  onClick,
  ...props
}: EpisodeCardProps) {
  return (
    <HoverPrefetchLink
      {...props}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick(index);
        }
      }}
      className={cn(
        "flex items-center justify-center rounded-lg font-medium transition-colors",
        dense ? "size-10 text-xs" : "size-12 text-sm",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {index + 1}
    </HoverPrefetchLink>
  );
}
