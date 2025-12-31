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

export async function searchVideosStream(query: string) {
  const validatedFields = searchSchema.safeParse({ query });

  if (!validatedFields.success) {
    throw new Error(validatedFields.error.message);
  }

  return sourceProvider.searchStream(validatedFields.data.query);
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
