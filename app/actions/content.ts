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
