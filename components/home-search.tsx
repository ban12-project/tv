"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { VideoCard } from "@/components/video-card";
import type { Messages } from "@/get-dictionary";
import { useVideoSearch } from "@/hooks/use-video-search";
import type { Video } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

export function HomeSearch({
  dictionary,
  initialResults = [],
}: {
  dictionary: Messages;
  initialResults?: Video[];
}) {
  const searchParams = useSearchParams();
  const [initialQuery] = React.useState(() => searchParams.get("q") || "");

  const {
    query,
    results,
    isPending,
    error,
    onQueryChange,
    onCompositionStart,
    onCompositionEnd,
  } = useVideoSearch(300, initialQuery, initialResults);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentQ = params.get("q") || "";
    if (currentQ === query) return;

    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [query]);

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange(e.target.value);
  };

  const hasResults = results.length > 0;

  return (
    <div className="flex flex-col px-2 md:px-4 lg:px-6 max-w-7xl mx-auto w-full relative z-10">
      {/* Search Header Container - Centered or Top */}
      <div
        className={cn(
          "transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col items-center justify-center",
          hasResults ? "h-40" : "h-[70vh]",
        )}
      >
        <div className="w-full max-w-2xl space-y-8">
          {!hasResults && !isPending && !query && (
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground">
                {dictionary["brand-name"].split(" ")[0] || "ECheng"}{" "}
                <span className="text-primary italic">
                  {dictionary["brand-name"].split(" ")[1] || "TV"}
                </span>
              </h1>
              <p className="text-neutral-400 text-lg md:text-xl max-w-md mx-auto">
                {dictionary.header["search-try-searching"]}
              </p>
            </div>
          )}

          <div className="group relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl group-hover:bg-primary/30 transition-all duration-500 rounded-full opacity-50" />
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                name="query"
                type="text"
                value={query}
                onChange={handleQueryChange}
                onCompositionStart={onCompositionStart}
                onCompositionEnd={onCompositionEnd}
                placeholder={dictionary.header["search-placeholder"]}
                className="w-full h-16 md:h-20 bg-secondary/40 backdrop-blur-xl border-2 border-border group-focus-within:border-primary/50 rounded-2xl px-6 text-xl md:text-2xl text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-300 shadow-2xl animate-caret-cycle"
                autoComplete="off"
              />
              {isPending && (
                <div className="absolute right-6">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div
        className={cn(
          "transition-all duration-1000 overflow-visible",
          hasResults
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
      >
        {hasResults && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
            {results.map((video: Video) => (
              <React.ViewTransition key={video.uniqueKey}>
                <VideoCard video={video} aspectRatio="2/3" />
              </React.ViewTransition>
            ))}
          </div>
        )}
      </div>

      {/* Empty State / No matches */}
      {query && !isPending && !hasResults && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 italic py-20 animate-in fade-in duration-700">
          {dictionary.header["search-no-results-found"].replace(
            "{query}",
            query,
          )}
        </div>
      )}

      {/* Error state */}
      {error && <div className="text-center text-red-500 py-10">{error}</div>}
    </div>
  );
}
