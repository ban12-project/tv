import { Download, Play, Plus, Share } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { fetchVideoDetails } from "@/app/actions/content";
import Link from "@/components/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n-config";

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
    id: string;
  }>;
}>;

export default function WatchPage({ params }: Props) {
  return (
    <ViewTransition>
      <Suspense fallback={<Loading />}>
        <Suspended params={params} />
      </Suspense>
    </ViewTransition>
  );
}

async function Suspended({ params }: Props) {
  const { id } = await params;

  const video = await fetchVideoDetails(id);

  if (!video) {
    notFound();
  }

  return (
    <>
      {/* Hero / Detail Area */}
      <section className="relative h-[70vh] min-h-[600px]">
        <div className="absolute inset-0">
          <Image
            src={video.backgroundImage || video.image || "/placeholder.jpg"}
            alt={video.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-b from-black/80 to-transparent h-32" />
        </div>

        <div className="relative h-full flex items-end pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-3xl space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {video.title}
            </h1>

            <div className="flex items-center space-x-4 text-sm md:text-base text-gray-300 font-medium">
              {video.year && <span>{video.year}</span>}
              <span>•</span>
              <span>{video.genre.join(", ")}</span>
              {video.duration && (
                <>
                  <span>•</span>
                  <span>{video.duration}</span>
                </>
              )}
            </div>

            <p className="text-lg text-gray-100 leading-relaxed line-clamp-4">
              {video.description}
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-neutral-200"
                asChild
              >
                <Link href={`/watch/${video.id}/1`}>
                  <Play className="mr-2 h-5 w-5 fill-black" /> Play
                </Link>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border-none"
              >
                <Plus className="mr-2 h-5 w-5" /> Add to List
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full bg-white/10 hover:bg-white/20"
              >
                <Download className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full bg-white/10 hover:bg-white/20"
              >
                <Share className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Details */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            {/* Cast */}
            {video.cast && video.cast.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold mb-4 text-gray-200">
                  Cast
                </h3>
                <div className="flex flex-wrap gap-2 text-gray-400">
                  {video.cast.map((c) => (
                    <span
                      key={c}
                      className="bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6 text-sm text-gray-400">
            {video.director && (
              <div>
                <span className="block text-gray-500 mb-1">Director</span>
                <span className="text-white">{video.director}</span>
              </div>
            )}
            {video.releaseDate && (
              <div>
                <span className="block text-gray-500 mb-1">Released</span>
                <span className="text-white">{video.releaseDate}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Loading() {
  return (
    <>
      {/* Hero / Detail Area Skeleton */}
      <section className="relative h-[70vh] min-h-[600px]">
        {/* Background Skeleton */}
        <div className="absolute inset-0 bg-neutral-900" />

        <div className="relative h-full flex items-end pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-3xl space-y-6">
            {/* Title Skeleton */}
            <Skeleton className="h-12 md:h-16 w-3/4 max-w-lg bg-white/10" />

            {/* Metadata (Year, Genre, Duration) Skeleton */}
            <div className="flex items-center space-x-4">
              <Skeleton className="h-5 w-12 bg-white/10" />
              <span className="text-gray-700">•</span>
              <Skeleton className="h-5 w-32 bg-white/10" />
              <span className="text-gray-700">•</span>
              <Skeleton className="h-5 w-16 bg-white/10" />
            </div>

            {/* Description Skeleton (multiple lines) */}
            <div className="space-y-2 pt-2">
              <Skeleton className="h-5 w-full bg-white/10" />
              <Skeleton className="h-5 w-full bg-white/10" />
              <Skeleton className="h-5 w-2/3 bg-white/10" />
            </div>

            {/* Buttons Skeleton */}
            <div className="flex flex-wrap gap-4 pt-4">
              <Skeleton className="h-12 w-32 rounded-md bg-white/10" />
              <Skeleton className="h-12 w-36 rounded-md bg-white/10" />
              <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
              <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      {/* Additional Details Skeleton */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Cast Skeleton */}
          <div className="md:col-span-2 space-y-8">
            <div>
              <Skeleton className="h-7 w-24 mb-4 bg-white/10" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-8 w-24 rounded-full bg-white/10"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Director / Release Date Skeleton */}
          <div className="space-y-6">
            <div>
              <Skeleton className="h-5 w-16 mb-2 bg-white/10" />
              <Skeleton className="h-5 w-32 bg-white/10" />
            </div>
            <div>
              <Skeleton className="h-5 w-16 mb-2 bg-white/10" />
              <Skeleton className="h-5 w-24 bg-white/10" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
