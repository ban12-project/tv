import * as React from "react";
import { searchVideosStream } from "@/lib/actions/content";
import type { Video } from "@/lib/adapters/types";
import { getVideoUniqueKey } from "@/lib/adapters/util";

const EMPTY_INITIAL_RESULTS: Video[] = [];

/**
 * Helper to calculate relevance score
 */
function getRelevanceScore(video: Video, query: string) {
  const title = video.title?.toLowerCase() || "";
  const q = query.toLowerCase().trim();

  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(` ${q}`)) return 60; // Word boundary
  if (title.includes(q)) return 40;
  return 0;
}

/**
 * Re-sort based on relevance
 */
function sortVideos(videos: Video[], query: string) {
  return videos.toSorted((a, b) => {
    const scoreA = getRelevanceScore(a, query);
    const scoreB = getRelevanceScore(b, query);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (
      Number.parseInt(b.year || "0", 10) - Number.parseInt(a.year || "0", 10)
    );
  });
}

export function useVideoSearch(
  debounceMs = 300,
  initialQuery = "",
  initialResults: Video[] = EMPTY_INITIAL_RESULTS,
) {
  const [query, setQuery] = React.useState(initialQuery);
  const [searchTerm, setSearchTerm] = React.useState(initialQuery);
  const [debouncedSearchTerm, setDebouncedSearchTerm] =
    React.useState(initialQuery);
  const [prevInitialQuery, setPrevInitialQuery] = React.useState(initialQuery);
  const [prevInitialResults, setPrevInitialResults] =
    React.useState(initialResults);
  const [results, setResults] = React.useState<Video[]>(() =>
    sortVideos(initialResults, initialQuery),
  );
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentSearchRef = React.useRef(0);
  const isComposingRef = React.useRef(false);
  const skipInitialRef = React.useRef(true);

  if (
    initialQuery !== prevInitialQuery ||
    initialResults !== prevInitialResults
  ) {
    setQuery(initialQuery);
    setSearchTerm(initialQuery);
    setDebouncedSearchTerm(initialQuery);
    setResults(sortVideos(initialResults, initialQuery));
    setPrevInitialQuery(initialQuery);
    setPrevInitialResults(initialResults);
    setIsPending(false);
    setError(null);
    currentSearchRef.current += 1;
    skipInitialRef.current = true;
  }

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm, debounceMs]);

  React.useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      if (debouncedSearchTerm === initialQuery) return;
    }

    const fetchVideos = async () => {
      if (!debouncedSearchTerm.trim()) {
        setResults([]);
        return;
      }

      const searchId = Date.now();
      currentSearchRef.current = searchId;

      setIsPending(true);
      setError(null);

      let isFirstChunk = true;
      try {
        const iterator = await searchVideosStream(debouncedSearchTerm);

        for await (const chunk of iterator) {
          if (currentSearchRef.current !== searchId) break;

          if (chunk.videos && chunk.videos.length > 0) {
            const currentFirstChunk = isFirstChunk;
            isFirstChunk = false;

            React.startTransition(() => {
              setResults((prev) => {
                const base = currentFirstChunk ? [] : prev;
                const existingKeys = new Set(
                  base.map((v) => getVideoUniqueKey(v)),
                );
                const newUniqueVideos = chunk.videos.filter((v) => {
                  const key = getVideoUniqueKey(v);
                  if (existingKeys.has(key)) return false;
                  existingKeys.add(key);
                  return true;
                });

                const merged = [...base, ...newUniqueVideos];

                return sortVideos(merged, debouncedSearchTerm);
              });
            });
          }
        }

        // If search finished and no results were ever found, clear results
        if (currentSearchRef.current === searchId && isFirstChunk) {
          setResults([]);
        }
      } catch (err) {
        if (currentSearchRef.current === searchId) {
          const message =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "An error occurred while searching.";
          console.error("Search error:", err);
          setError(message);
        }
      } finally {
        if (currentSearchRef.current === searchId) {
          setIsPending(false);
        }
      }
    };

    fetchVideos();
  }, [debouncedSearchTerm, initialQuery]);

  const onQueryChange = React.useCallback((value: string) => {
    setQuery(value);

    // Clear results immediately if empty
    if (!value.trim()) {
      setSearchTerm("");
      setResults([]);
      setIsPending(false);
      currentSearchRef.current += 1;
      return;
    }

    // Only update search term if not composing
    if (!isComposingRef.current) {
      setSearchTerm(value);
    }
  }, []);

  const onCompositionStart = React.useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const onCompositionEnd = React.useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = false;
      const value = e.currentTarget.value;
      if (value.trim()) {
        setSearchTerm(value);
      }
    },
    [],
  );

  return {
    query,
    debouncedQuery: debouncedSearchTerm,
    setQuery,
    results,
    setResults,
    isPending,
    error,
    onQueryChange,
    onCompositionStart,
    onCompositionEnd,
  };
}
