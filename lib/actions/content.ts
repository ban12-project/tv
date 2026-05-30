"use server";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import * as z from "zod";
import type { ContentProfile, Video } from "@/lib/adapters/types";
import { requireRegisteredUser } from "@/lib/auth-utils";
import {
  inferContentProfile,
  isPortraitDimensions,
  mergeContentProfiles,
} from "@/lib/content-profile";
import {
  getEpisodeMetadataCacheQuery,
  upsertEpisodeMetadataCacheQuery,
} from "@/lib/db/queries";
import { MissingApiSourcesError, sourceProvider } from "@/lib/source-provider";

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

const contentProfileSchema = z.object({
  sourceId: z.string().min(1),
  videoId: z.string().min(1),
});

const saveContentProfileSchema = z.object({
  sourceId: z.string().min(1),
  videoId: z.string().min(1),
  resourceUrl: z.string().min(1).nullable().optional(),
  profile: z.object({
    kind: z.enum(["standard", "short-drama"]),
    confidence: z.number().min(0).max(100),
    signals: z.array(z.string()).default([]),
    aspectRatio: z.string().optional(),
  }),
});

const PLAYER_LAYOUT_METADATA_KEY = "player-layout";
const CONTENT_PROFILE_METADATA_KEY = "content-profile";

export interface EpisodeLayoutMetadata {
  aspectRatio: string;
  width?: number;
  height?: number;
}

function getEpisodeAspectRatioTag(sourceId: string, videoId: string) {
  return `episode-aspect-ratio:${sourceId}:${videoId}`;
}

function getContentProfileTag(sourceId: string, videoId: string) {
  return `content-profile:${sourceId}:${videoId}`;
}

function normalizeContentProfile(
  metadata?: Record<string, unknown>,
): ContentProfile | null {
  if (!metadata) return null;

  const kind = metadata.kind === "short-drama" ? "short-drama" : "standard";
  const confidence =
    typeof metadata.confidence === "number" &&
    Number.isFinite(metadata.confidence)
      ? Math.max(0, Math.min(100, Math.round(metadata.confidence)))
      : 0;
  const signals = Array.isArray(metadata.signals)
    ? metadata.signals.filter(
        (signal): signal is string => typeof signal === "string",
      )
    : [];
  const inferredAt =
    typeof metadata.inferredAt === "string" ? metadata.inferredAt : undefined;
  const aspectRatio =
    typeof metadata.aspectRatio === "string" ? metadata.aspectRatio : undefined;

  return {
    kind,
    confidence,
    signals,
    inferredAt,
    aspectRatio,
  };
}

export async function fetchVideoDetails(id: string, sourceId: string) {
  "use cache";
  cacheTag(`video-${id}-${sourceId}`);
  cacheLife("days");

  try {
    return await sourceProvider.getDetails(id, sourceId);
  } catch (error) {
    if (error instanceof MissingApiSourcesError) {
      throw error;
    }
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
    if (e instanceof MissingApiSourcesError) {
      throw e;
    }
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

export async function findMatchesStream(
  video: Pick<Video, "title" | "year" | "type">,
) {
  return sourceProvider.findMatchesStream(video);
}

export async function getEpisodeAspectRatio(payload: {
  sourceId: string;
  videoId: string;
}) {
  const layoutMetadata = await getEpisodeLayoutMetadata(payload);
  return layoutMetadata?.aspectRatio ?? null;
}

export async function getEpisodeLayoutMetadata(payload: {
  sourceId: string;
  videoId: string;
}): Promise<EpisodeLayoutMetadata | null> {
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
    const metadata = cachedMetadata[0]?.metadata as
      | Record<string, unknown>
      | null
      | undefined;
    const cachedAspectRatio =
      typeof metadata?.aspectRatio === "string"
        ? metadata.aspectRatio
        : undefined;

    if (cachedAspectRatio) {
      return {
        aspectRatio: cachedAspectRatio,
        height:
          typeof metadata?.height === "number" ? metadata.height : undefined,
        width: typeof metadata?.width === "number" ? metadata.width : undefined,
      };
    }
  } catch (error) {
    console.error("[getEpisodeLayoutMetadata] DB read error:", error);
    return null;
  }

  return null;
}

export async function getContentProfile(payload: {
  sourceId: string;
  videoId: string;
}) {
  "use cache";
  cacheLife("days");

  const validatedFields = contentProfileSchema.safeParse(payload);

  if (!validatedFields.success) {
    return null;
  }

  const { sourceId, videoId } = validatedFields.data;
  cacheTag(getContentProfileTag(sourceId, videoId));

  try {
    const cachedMetadata = await getEpisodeMetadataCacheQuery(
      sourceId,
      videoId,
      CONTENT_PROFILE_METADATA_KEY,
    );

    return normalizeContentProfile(cachedMetadata[0]?.metadata);
  } catch (error) {
    console.error("[getContentProfile] DB read error:", error);
    return null;
  }
}

export async function saveContentProfile(payload: {
  sourceId: string;
  videoId: string;
  resourceUrl?: string | null;
  profile: ContentProfile;
}) {
  try {
    await requireRegisteredUser();
  } catch {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const validatedFields = saveContentProfileSchema.safeParse(payload);

  if (!validatedFields.success) {
    return { success: false, error: "Invalid payload" };
  }

  const { sourceId, videoId, resourceUrl, profile } = validatedFields.data;

  try {
    const cachedMetadata = await getEpisodeMetadataCacheQuery(
      sourceId,
      videoId,
      CONTENT_PROFILE_METADATA_KEY,
    );
    const existingProfile = normalizeContentProfile(
      cachedMetadata[0]?.metadata,
    );
    const nextProfile = mergeContentProfiles(existingProfile, {
      ...profile,
      inferredAt: new Date().toISOString(),
    });

    await upsertEpisodeMetadataCacheQuery({
      sourceId,
      videoId,
      metadataKey: CONTENT_PROFILE_METADATA_KEY,
      resourceUrl: resourceUrl ?? null,
      metadata: { ...nextProfile },
    });
    updateTag(getContentProfileTag(sourceId, videoId));

    return { success: true, profile: nextProfile };
  } catch (error) {
    console.error("[saveContentProfile] Error:", error);
    return { success: false, error: "Failed to save content profile" };
  }
}

export async function saveVideoAspectRatio(payload: {
  sourceId: string;
  videoId: string;
  width: number;
  height: number;
  resourceUrl?: string | null;
}) {
  try {
    await requireRegisteredUser();
  } catch {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const validatedFields = saveAspectRatioSchema.safeParse(payload);

  if (!validatedFields.success) {
    return { success: false, error: "Invalid payload" };
  }

  const { sourceId, videoId, width, height, resourceUrl } =
    validatedFields.data;
  const aspectRatio = `${width} / ${height}`;
  const inferredProfile = inferContentProfile(
    {
      title: "",
      genre: [],
      description: "",
      episodes: [],
    },
    { aspectRatio, width, height },
  );

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

    if (isPortraitDimensions(width, height)) {
      const cachedMetadata = await getEpisodeMetadataCacheQuery(
        sourceId,
        videoId,
        CONTENT_PROFILE_METADATA_KEY,
      );
      const nextProfile = mergeContentProfiles(
        normalizeContentProfile(cachedMetadata[0]?.metadata),
        {
          ...inferredProfile,
          inferredAt: new Date().toISOString(),
        },
      );

      await upsertEpisodeMetadataCacheQuery({
        sourceId,
        videoId,
        metadataKey: CONTENT_PROFILE_METADATA_KEY,
        resourceUrl: resourceUrl ?? null,
        metadata: { ...nextProfile },
      });
      updateTag(getContentProfileTag(sourceId, videoId));
    }

    updateTag(getEpisodeAspectRatioTag(sourceId, videoId));

    return { success: true, aspectRatio };
  } catch (error) {
    console.error("[saveVideoAspectRatio] Error:", error);
    return { success: false, error: "Failed to save aspect ratio" };
  }
}
