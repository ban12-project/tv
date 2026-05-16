import "server-only";
import { and, desc, eq, gt, type SQL, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "./client";
import {
  allowList,
  apiSource,
  embeddings,
  episodeMetadataCache,
  passkey,
  recommendations,
  resources,
  user,
  watchHistory,
} from "./schema";

export { getDb };

// -- CMS Queries --

export async function getApiSourcesQuery() {
  "use cache";
  cacheTag("api-sources");
  cacheLife("days");
  return await getDb().select().from(apiSource).orderBy(apiSource.createdAt);
}

export async function createApiSourceQuery(data: {
  name: string;
  url: string;
  type: string;
}) {
  return await getDb().insert(apiSource).values(data);
}

export async function updateApiSourceQuery(
  id: string,
  data: { name: string; url: string; type: string },
) {
  return await getDb().update(apiSource).set(data).where(eq(apiSource.id, id));
}

export async function deleteApiSourceQuery(id: string) {
  return await getDb().delete(apiSource).where(eq(apiSource.id, id));
}

// -- Recommendation Queries --
export async function getRecommendationsQuery(limit: number) {
  "use cache";
  cacheTag("recommendations");
  cacheLife("hours");
  return await getDb()
    .select()
    .from(recommendations)
    .orderBy(desc(recommendations.createdAt))
    .limit(limit);
}

export async function findRecommendation(
  userId: string,
  sourceId?: string | null,
  videoId?: string | null,
) {
  return await getDb()
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.userId, userId),
        sourceId
          ? and(
              eq(recommendations.sourceId, sourceId),
              eq(recommendations.videoId, videoId || ""),
            )
          : undefined,
      ),
    )
    .limit(1);
}

export async function createRecommendationQuery(data: {
  title: string;
  description: string;
  image: string;
  sourceId: string | null;
  videoId: string | null;
  epIndex: string | null;
  userId: string;
}) {
  return await getDb()
    .insert(recommendations)
    .values(data)
    .onConflictDoNothing({
      target: [
        recommendations.userId,
        recommendations.sourceId,
        recommendations.videoId,
      ],
    });
}

export async function deleteRecommendationQuery(
  userId: string,
  sourceId: string,
  videoId: string,
) {
  return await getDb()
    .delete(recommendations)
    .where(
      and(
        eq(recommendations.userId, userId),
        eq(recommendations.sourceId, sourceId),
        eq(recommendations.videoId, videoId),
      ),
    );
}

export async function findRecommendationByVideoId(
  sourceId: string,
  videoId: string,
) {
  return await getDb()
    .select({ title: recommendations.title })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.sourceId, sourceId),
        eq(recommendations.videoId, videoId),
      ),
    )
    .limit(1);
}

// -- Auth/Allowlist Queries --
export async function findAllowlistByEmail(email: string) {
  return await getDb()
    .select()
    .from(allowList)
    .where(eq(allowList.email, email))
    .limit(1);
}

export async function getAllAllowList() {
  "use cache";
  cacheTag("allow-list");
  cacheLife("days");
  return await getDb().select().from(allowList);
}

export async function addToAllowListQuery(email: string) {
  return await getDb().insert(allowList).values({ email });
}

export async function removeFromAllowListQuery(id: string) {
  return await getDb().delete(allowList).where(eq(allowList.id, id));
}

export async function findPasskeyRegistrationByName(name: string) {
  return await getDb()
    .select({
      userId: passkey.userId,
      isAnonymous: user.isAnonymous,
    })
    .from(passkey)
    .innerJoin(user, eq(passkey.userId, user.id))
    .where(sql`lower(${passkey.name}) = ${name}`);
}

export async function findUserByEmail(email: string) {
  return await getDb()
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
}

// -- AI/Embedding Queries --
export async function findRelevantContentQuery(
  similarity: SQL<number>,
  limit = 4,
  threshold = 0.5,
) {
  return await getDb()
    .select({ name: resources.content, similarity })
    .from(embeddings)
    .leftJoin(resources, eq(embeddings.resourceId, resources.id))
    .where(gt(similarity, threshold))
    .orderBy(desc(similarity))
    .limit(limit);
}

export async function getEpisodeMetadataCacheQuery(
  sourceId: string,
  videoId: string,
  metadataKey: string,
) {
  return await getDb()
    .select({
      metadata: episodeMetadataCache.metadata,
      resourceUrl: episodeMetadataCache.resourceUrl,
    })
    .from(episodeMetadataCache)
    .where(
      and(
        eq(episodeMetadataCache.sourceId, sourceId),
        eq(episodeMetadataCache.videoId, videoId),
        eq(episodeMetadataCache.metadataKey, metadataKey),
      ),
    )
    .limit(1);
}

export async function upsertWatchProgressQuery(data: {
  userId: string;
  videoId: string;
  sourceId: string;
  epIndex: number;
  progress: number;
  duration: number;
}) {
  return await getDb()
    .insert(watchHistory)
    .values({
      userId: data.userId,
      videoId: data.videoId,
      sourceId: data.sourceId,
      epIndex: data.epIndex,
      progress: Math.floor(data.progress),
      duration: Math.floor(data.duration),
    })
    .onConflictDoUpdate({
      target: [
        watchHistory.userId,
        watchHistory.videoId,
        watchHistory.sourceId,
      ],
      set: {
        epIndex: data.epIndex,
        progress: Math.floor(data.progress),
        duration: Math.floor(data.duration),
        updatedAt: sql`now()`,
      },
    });
}

export async function upsertEpisodeMetadataCacheQuery(data: {
  sourceId: string;
  videoId: string;
  metadataKey: string;
  resourceUrl?: string | null;
  metadata: Record<string, unknown>;
}) {
  return await getDb()
    .insert(episodeMetadataCache)
    .values({
      sourceId: data.sourceId,
      videoId: data.videoId,
      metadataKey: data.metadataKey,
      resourceUrl: data.resourceUrl ?? null,
      metadata: data.metadata,
    })
    .onConflictDoUpdate({
      target: [
        episodeMetadataCache.sourceId,
        episodeMetadataCache.videoId,
        episodeMetadataCache.metadataKey,
      ],
      set: {
        resourceUrl: data.resourceUrl ?? null,
        metadata: data.metadata,
        updatedAt: sql`now()`,
      },
    });
}
