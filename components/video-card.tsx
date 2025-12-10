import Image from "next/image";
import Link from "@/components/link";
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
  width = 400,
  height = 225,
  aspectRatio = "16/9",
}: VideoCardProps) {
  return (
    <Link
      href={`/show/${video.id}`}
      className={cn(
        "group relative shrink-0 focus-visible:outline-none",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-neutral-900 shadow-md transition-transform duration-300 ease-out group-hover:scale-105 group-focus-visible:scale-105 group-focus-visible:ring-4 ring-white",
          aspectRatio === "16/9"
            ? "aspect-video"
            : aspectRatio === "2/3"
              ? "aspect-2/3"
              : "aspect-square",
        )}
        style={{
          width: aspectRatio === "16/9" ? width : "auto",
          height: aspectRatio === "2/3" ? height : "auto",
        }}
      >
        <Image
          src={video.image || video.backgroundImage || "/placeholder.jpg"}
          alt={video.title}
          fill
          className="object-cover transition-opacity duration-300 group-hover:opacity-100 opacity-90"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* Optional Overlay on Hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="text-white font-semibold tracking-wide drop-shadow-md">
            Play
          </span>
        </div>
      </div>

      <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-focus-visible:opacity-100">
        <h3 className="text-base font-medium text-white truncate w-full">
          {video.title}
        </h3>
        <p className="text-sm text-neutral-400 truncate">
          {video.year} • {video.genre[0]}
        </p>
      </div>
    </Link>
  );
}
