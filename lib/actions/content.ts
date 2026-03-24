"use server";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import * as z from "zod";
import type { Video } from "@/lib/adapters/types";
import {
  getEpisodeMetadataCacheQuery,
  upsertEpisodeMetadataCacheQuery,
} from "@/lib/db/queries";
import { sourceProvider } from "@/lib/source-provider";

const searchSchema = z.object({
  query: z
    .string()
    .min(1, "Search query is required")
    .max(100, "Search query is too long"),
});

const aspectRatioSchema = z.object({
  sourceId: z.string().min(1),
  videoId: z.string().min(1),
});

const saveAspectRatioSchema = z.object({
  sourceId: z.string().min(1),
  videoId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  resourceUrl: z.string().min(1).nullable().optional(),
});

const PLAYER_LAYOUT_METADATA_KEY = "player-layout";

function getEpisodeAspectRatioTag(sourceId: string, videoId: string) {
  return `episode-aspect-ratio:${sourceId}:${videoId}`;
}

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

export async function getEpisodeAspectRatio(payload: {
  sourceId: string;
  videoId: string;
}) {
  "use cache";
  cacheLife("days");

  const validatedFields = aspectRatioSchema.safeParse(payload);

  if (!validatedFields.success) {
    return null;
  }

  const { sourceId, videoId } = validatedFields.data;
  cacheTag(getEpisodeAspectRatioTag(sourceId, videoId));

  try {
    const cachedMetadata = await getEpisodeMetadataCacheQuery(
      sourceId,
      videoId,
      PLAYER_LAYOUT_METADATA_KEY,
    );
    const cachedAspectRatio = cachedMetadata[0]?.metadata?.aspectRatio as
      | string
      | undefined;

    if (cachedAspectRatio) {
      return cachedAspectRatio;
    }
  } catch (error) {
    console.error("[getEpisodeAspectRatio] DB read error:", error);
    return null;
  }

  return null;
}

export async function saveVideoAspectRatio(payload: {
  sourceId: string;
  videoId: string;
  width: number;
  height: number;
  resourceUrl?: string | null;
}) {
  const validatedFields = saveAspectRatioSchema.safeParse(payload);

  if (!validatedFields.success) {
    return { success: false, error: "Invalid payload" };
  }

  const { sourceId, videoId, width, height, resourceUrl } =
    validatedFields.data;
  const aspectRatio = `${width} / ${height}`;

  try {
    await upsertEpisodeMetadataCacheQuery({
      sourceId,
      videoId,
      metadataKey: PLAYER_LAYOUT_METADATA_KEY,
      resourceUrl: resourceUrl ?? null,
      metadata: {
        aspectRatio,
        width,
        height,
      },
    });
    updateTag(getEpisodeAspectRatioTag(sourceId, videoId));

    return { success: true, aspectRatio };
  } catch (error) {
    console.error("[saveVideoAspectRatio] Error:", error);
    return { success: false, error: "Failed to save aspect ratio" };
  }
}
