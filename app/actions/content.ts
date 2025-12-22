"use server";

import { cacheLife, cacheTag } from "next/cache";
import * as z from "zod";
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
    const adapter = await sourceProvider.getAdapter(sourceId);
    if (adapter) {
      const video = await adapter.getDetails(id);
      return video ? { ...video, sourceId } : null;
    }

    // Fallback or "Try All" if no sourceId
    const video = await sourceProvider.getDetails(id);
    return video;
  } catch (error) {
    console.error(`Error fetching details for ${id}:`, error);
    return null;
  }
}

export async function searchVideos(_prevState: unknown, formData: FormData) {
  const query = formData.get("query");

  const validatedFields = searchSchema.safeParse({ query });

  if (!validatedFields.success) {
    return {
      errors: z.flattenError(validatedFields.error).fieldErrors,
      results: [],
    };
  }

  try {
    const results = await sourceProvider.search(validatedFields.data.query);
    return {
      errors: null,
      results: results.videos,
    };
  } catch (error) {
    console.error("Search error:", error);
    return {
      errors: { query: ["An unexpected error occurred"] },
      results: [],
    };
  }
}

export async function getCategory(id: string) {
  "use cache";
  cacheTag(`category-${id}`);
  cacheLife("days");

  try {
    const categories = await sourceProvider.getCategories();
    return categories.find((c) => c.id.toString() === id);
  } catch (error) {
    console.error(`Error fetching category ${id}:`, error);
    return null;
  }
}

export async function getCategoryVideos(id: string, page = 1) {
  "use cache";
  cacheTag(`category-${id}`);
  cacheLife("hours");

  try {
    return await sourceProvider.getVideos({
      t: id,
      pg: page,
      ac: "detail",
    });
  } catch (error) {
    console.error(`Error fetching videos for category ${id}:`, error);
    return {
      videos: [],
      total: 0,
      page: 1,
      limit: 20,
    };
  }
}

import type { Video } from "@/lib/adapters/types";

export async function searchVideosStream(query: string) {
  return sourceProvider.searchStream(query);
}

export async function findMatchesStream(video: Video) {
  return sourceProvider.findMatchesStream(video);
}

export async function getCategoryVideosStream(id: string, page = 1) {
  return sourceProvider.getVideosStream({
    t: id,
    pg: page,
    ac: "detail",
  });
}
