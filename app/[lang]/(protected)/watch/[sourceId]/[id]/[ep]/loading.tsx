import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="space-y-8">
      {/* Main Player Area Skeleton */}
      <div className="w-full max-w-7xl mx-auto lg:px-6">
        <div className="aspect-video bg-secondary animate-pulse rounded-lg"></div>
      </div>

      {/* Episode Selector Skeleton */}
      <ul className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="w-12 h-12 rounded-lg bg-muted" />
          </li>
        ))}
      </ul>

      {/* Info Section Skeleton */}
      <section className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="w-full max-w-3xl space-y-6">
          {/* Title */}
          <Skeleton className="h-10 md:h-16 w-3/4 bg-muted" />

          {/* Metadata */}
          <div className="flex items-center space-x-4">
            <Skeleton className="h-5 w-12 bg-muted" />
            <span className="text-gray-600">•</span>
            <Skeleton className="h-5 w-32 bg-white/10" />
            <span className="text-gray-600">•</span>
            <Skeleton className="h-5 w-16 bg-muted" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-full bg-muted" />
            <Skeleton className="h-5 w-full bg-muted" />
            <Skeleton className="h-5 w-2/3 bg-white/10" />
          </div>
        </div>
      </section>

      {/* Additional Details Skeleton */}
      <section className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            {/* Cast */}
            <Skeleton className="h-7 w-16 mb-4 bg-muted" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-8 w-24 rounded-full bg-secondary border border-border"
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Director */}
            <div>
              <Skeleton className="h-5 w-24 bg-muted" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
