import { CMSImage } from "@/components/cms-image";
import HoverPrefetchLink from "@/components/hover-prefetch-link";
import { Badge } from "@/components/ui/badge";
import type { Video } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  video: Video;
  className?: string;
  width?: number;
  height?: number;
  aspectRatio?: "16/9" | "2/3" | "1/1";
}

export function VideoCard({
  video,
  className,
  width,
  height,
  aspectRatio = "16/9",
}: VideoCardProps) {
  return (
    <HoverPrefetchLink
      href={`/watch/${video.sourceId}/${video.id}/1`}
      className={cn(
        "group relative shrink-0 focus-visible:outline-none",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-secondary shadow-md transition-transform duration-300 ease-out group-hover:scale-105 group-focus-visible:scale-105 group-focus-visible:ring-4 ring-primary",
          aspectRatio === "16/9"
            ? "aspect-video"
            : aspectRatio === "2/3"
              ? "aspect-2/3"
              : "aspect-square",
        )}
        style={{
          width: width ? width : "auto",
          height: height ? height : "auto",
        }}
      >
        {/* Source Badge */}
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <Badge className="bg-background/40 backdrop-blur-md border-border text-foreground/90 text-[10px] px-2 py-0.5 font-normal">
            {video.sourceName}
          </Badge>
        </div>

        <CMSImage
          src={video.image || video.backgroundImage || "/placeholder.jpg"}
          alt={video.title}
          fill
          className="object-cover transition-opacity duration-300 group-hover:opacity-100 opacity-90"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      <div className="mt-3 duration-300 group-focus-visible:opacity-100">
        <h3 className="text-base font-medium text-foreground truncate w-full">
          {video.title}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          {video.year} • {video.genre.join(", ")}
        </p>
      </div>
    </HoverPrefetchLink>
  );
}
