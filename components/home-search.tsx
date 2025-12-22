"use client";

import { Loader2, Search } from "lucide-react";
import * as React from "react";
import { useDebounceCallback } from "usehooks-ts";
import { searchVideosStream } from "@/app/actions/content";
import { VideoCard } from "@/components/video-card";
import type { Messages } from "@/get-dictionary";
import type { Video } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

// Helper to calculate relevance score
function getRelevanceScore(video: Video, query: string) {
  const title = video.title?.toLowerCase() || "";
  const q = query.toLowerCase().trim();

  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(` ${q}`)) return 60; // Word boundary
  if (title.includes(q)) return 40;
  return 0;
}

export function HomeSearch({ dictionary }: { dictionary: Messages }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Video[]>([]);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Track the latest search timestamp to ignore stale results
  const currentSearchRef = React.useRef(0);

  const performSearch = useDebounceCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // Cancel previous request logic is tricky with Server Actions + Iterators directly (no abort signal usually).
    // However, we can just ignore results if a new search started by producing a "current search ID".
    const searchId = Date.now();
    // store searchId in ref to validation?
    // Actually, `useTransition` or simple effect variable is easiest.

    // Let's use a ref to track validity
    currentSearchRef.current = searchId;

    setIsPending(true);
    setError(null);
    setResults([]);

    try {
      const iterator = await searchVideosStream(searchQuery);

      for await (const chunk of iterator) {
        if (currentSearchRef.current !== searchId) break;

        if (chunk.videos && chunk.videos.length > 0) {
          React.startTransition(() => {
            setResults((prev) => {
              const existingKeys = new Set(
                prev.map((v) =>
                  `${v.title}-${v.year}-${v.episodes?.length === 1 ? "movie" : "tv"}`.replace(
                    /\s+/g,
                    "",
                  ),
                ),
              );
              const newUniqueVideos = chunk.videos.filter((v) => {
                const key = `${v.title}-${v.year}-${
                  v.episodes?.length === 1 ? "movie" : "tv"
                }`.replace(/\s+/g, "");
                if (existingKeys.has(key)) return false;
                existingKeys.add(key);
                return true;
              });

              const merged = [...prev, ...newUniqueVideos];

              // Re-sort based on relevance to the SEARCH QUERY
              return merged.sort((a, b) => {
                const scoreA = getRelevanceScore(a, searchQuery);
                const scoreB = getRelevanceScore(b, searchQuery);
                if (scoreA !== scoreB) return scoreB - scoreA;
                // Secondary sort: Year descending
                return (
                  parseInt(b.year || "0", 10) - parseInt(a.year || "0", 10)
                );
              });
            });
          });
        }
      }
    } catch (err) {
      if (currentSearchRef.current === searchId) {
        console.error("Search error:", err);
        setError("An error occurred while searching.");
      }
    } finally {
      if (currentSearchRef.current === searchId) {
        setIsPending(false);
      }
    }
  }, 300);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim()) {
      performSearch(value);
    } else {
      setResults([]);
      setIsPending(false);
      // Invalidate current search if any
      currentSearchRef.current = Date.now();
    }
  };

  const hasResults = results.length > 0;

  return (
    <div className="flex flex-col px-4 md:px-8 max-w-7xl mx-auto w-full relative z-10">
      {/* Search Header Container - Centered or Top */}
      <div
        className={cn(
          "transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col items-center justify-center",
          hasResults ? "h-40 mt-10" : "h-[70vh]",
        )}
      >
        <div className="w-full max-w-2xl space-y-8">
          {!hasResults && !isPending && !query && (
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white">
                Ban12 <span className="text-primary italic">TV</span>
              </h1>
              <p className="text-neutral-400 text-lg md:text-xl max-w-md mx-auto">
                {dictionary.header["search-try-searching"]}
              </p>
            </div>
          )}

          <div className="group relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl group-hover:bg-primary/30 transition-all duration-500 rounded-full opacity-50" />
            <div className="relative flex items-center">
              <Search className="absolute left-6 h-6 w-6 text-neutral-500 group-focus-within:text-primary transition-colors duration-300" />
              <input
                name="query"
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder={dictionary.header["search-placeholder"]}
                className="w-full h-16 md:h-20 bg-neutral-900/80 backdrop-blur-xl border-2 border-white/5 group-focus-within:border-primary/50 rounded-2xl px-6 text-xl md:text-2xl text-white placeholder:text-neutral-600 outline-none transition-all duration-300 shadow-2xl animate-caret-cycle"
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
              <React.ViewTransition key={`${video.sourceId}-${video.id}`}>
                <div className="animate-in fade-in zoom-in-95 duration-500 fill-mode-both">
                  <VideoCard video={video} aspectRatio="2/3" />
                </div>
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
