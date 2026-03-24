"use server";

import { cacheLife, cacheTag } from "next/cache";
import * as z from "zod";
import type { Episode, Video } from "@/lib/adapters/types";
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

const episodeSchema = z.object({
  name: z.string(),
  url: z.string().min(1),
});

const sourceGroupSchema = z.object({
  name: z.string(),
  sourceId: z.string().min(1),
  videoId: z.string().min(1),
  episodes: z.array(episodeSchema),
});

const aspectRatioSchema = z.object({
  sources: z.array(sourceGroupSchema),
  sourceId: z.string().min(1),
  episodeIndex: z.number().int().min(0),
});

const aspectRatioCache = new Map<string, string | null>();
const PLAYER_LAYOUT_METADATA_KEY = "player-layout";

function getEpisodeUrl(
  sources: {
    name: string;
    sourceId: string;
    videoId: string;
    episodes: Episode[];
  }[],
  sourceId: string,
  episodeIndex: number,
) {
  const source = sources.find((item) => item.sourceId === sourceId);
  return source?.episodes[episodeIndex]?.url ?? null;
}

function getEpisodeSource(
  sources: {
    name: string;
    sourceId: string;
    videoId: string;
    episodes: Episode[];
  }[],
  sourceId: string,
) {
  return sources.find((item) => item.sourceId === sourceId) ?? null;
}

function extractAspectRatioFromManifest(manifest: string) {
  const match = manifest.match(
    /#EXT-X-STREAM-INF:[^\n]*\bRESOLUTION=(\d+)x(\d+)/i,
  );

  if (!match) {
    return null;
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);

  if (
    Number.isNaN(width) ||
    Number.isNaN(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return `${width} / ${height}`;
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
  sources: {
    name: string;
    sourceId: string;
    videoId: string;
    episodes: Episode[];
  }[];
  sourceId: string;
  episodeIndex: number;
}) {
  const validatedFields = aspectRatioSchema.safeParse(payload);

  if (!validatedFields.success) {
    return null;
  }

  const { sources, sourceId, episodeIndex } = validatedFields.data;
  const source = getEpisodeSource(sources, sourceId);
  const episodeUrl = getEpisodeUrl(sources, sourceId, episodeIndex);

  if (!source || !episodeUrl) {
    return null;
  }

  if (aspectRatioCache.has(episodeUrl)) {
    return aspectRatioCache.get(episodeUrl) ?? null;
  }

  try {
    const cachedMetadata = await getEpisodeMetadataCacheQuery(
      sourceId,
      source.videoId,
      episodeIndex,
      PLAYER_LAYOUT_METADATA_KEY,
    );
    const cachedAspectRatio = cachedMetadata[0]?.metadata?.aspectRatio as
      | string
      | undefined;

    if (cachedAspectRatio) {
      aspectRatioCache.set(episodeUrl, cachedAspectRatio);
      return cachedAspectRatio;
    }
  } catch (error) {
    console.error("[getEpisodeAspectRatio] DB read error:", error);
  }

  try {
    const response = await fetch(episodeUrl, {
      method: "GET",
      headers: {
        Accept:
          "application/vnd.apple.mpegurl, application/x-mpegURL, text/plain;q=0.9, */*;q=0.1",
      },
      cache: "force-cache",
    });

    if (!response.ok) {
      aspectRatioCache.set(episodeUrl, null);
      return null;
    }

    const manifest = await response.text();
    const aspectRatio = extractAspectRatioFromManifest(manifest);
    aspectRatioCache.set(episodeUrl, aspectRatio);

    if (aspectRatio) {
      void upsertEpisodeMetadataCacheQuery({
        sourceId,
        videoId: source.videoId,
        epIndex: episodeIndex,
        metadataKey: PLAYER_LAYOUT_METADATA_KEY,
        resourceUrl: episodeUrl,
        metadata: {
          aspectRatio,
        },
      }).catch((error) => {
        console.error("[getEpisodeAspectRatio] DB write error:", error);
      });
    }

    return aspectRatio;
  } catch (error) {
    console.error("[getEpisodeAspectRatio] Error:", error);
    aspectRatioCache.set(episodeUrl, null);
    return null;
  }
}
