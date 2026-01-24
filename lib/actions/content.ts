"use server";

import { cacheLife, cacheTag } from "next/cache";
import * as z from "zod";
import type { Video } from "@/lib/adapters/types";
import { sourceProvider } from "@/lib/source-provider";

const searchSchema = z.object({
  query: z
    .string()
    .min(1, "Search query is required")
    .max(100, "Search query is too long"),
});

export async function fetchVideoDetails(id: string, sourceId: string) {
  "use cache";
  cacheTag(`video-${id}-${sourceId}`);
  cacheLife("days");

  try {
    return await sourceProvider.getDetails(id, sourceId);
  } catch (error) {
    console.error(`Error fetching details for ${id}:`, error);
    return null;
  }
}

export async function getInitialSearchResults(query: string) {
  "use cache";
  cacheTag(`search-${query}`);
  cacheLife("hours");

  const validatedFields = searchSchema.safeParse({ query });

  if (!validatedFields.success) {
    return [];
  }

  // Fetch just the first page (non-streaming or simulated)
  // We'll use the searchStream but only take the first chunk(s) or use a non-streaming alternative if available.
  // Since sourceProvider.searchStream returns a generator, we can consume it partially.
  const results: Video[] = [];
  try {
    const stream = sourceProvider.searchStream(validatedFields.data.query);
    for await (const chunk of stream) {
      if (chunk.videos) {
        results.push(...chunk.videos);
        if (results.length >= 20) break;
      }
    }
  } catch (e) {
    console.error("Initial search failed", e);
  }

  return results;
}

export async function searchVideosStream(query: string) {
  // Streaming functions cannot use "use cache" directly as related to generators
  // caching is handled by the initial search results function for the first paint

  const validatedFields = searchSchema.safeParse({ query });

  if (!validatedFields.success) {
    throw new Error(validatedFields.error.message);
  }

  return sourceProvider.searchStream(validatedFields.data.query);
}

export async function findMatchesStream(video: Video) {
  return sourceProvider.findMatchesStream(video);
}
