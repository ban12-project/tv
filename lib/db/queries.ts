import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { cacheLife, cacheTag } from "next/cache";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const sql = neon(process.env.DATABASE_URL);

import * as schema from "./schema";

export const db = drizzle({ client: sql, schema });

import { and, desc, eq, gt, type SQL } from "drizzle-orm";
import {
  allowList,
  apiSource,
  embeddings,
  episodeMetadataCache,
  passkey,
  recommendations,
  resources,
  user,
} from "./schema";
// -- CMS Queries --

export async function getApiSourcesQuery() {
  "use cache";
  cacheTag("api-sources");
  cacheLife("days");
  return await db.select().from(apiSource).orderBy(apiSource.createdAt);
}

export async function createApiSourceQuery(data: {
  name: string;
  url: string;
  type: string;
}) {
  return await db.insert(apiSource).values(data);
}

export async function updateApiSourceQuery(
  id: string,
  data: { name: string; url: string; type: string },
) {
  return await db.update(apiSource).set(data).where(eq(apiSource.id, id));
}

export async function deleteApiSourceQuery(id: string) {
  return await db.delete(apiSource).where(eq(apiSource.id, id));
}

// -- Recommendation Queries --
export async function getRecommendationsQuery(limit: number) {
  "use cache";
  cacheTag("recommendations");
  cacheLife("hours");
  return await db
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
  return await db
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
  return await db.insert(recommendations).values(data);
}

export async function deleteRecommendationQuery(
  userId: string,
  sourceId: string,
  videoId: string,
) {
  return await db
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
  return await db
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
  return await db
    .select()
    .from(allowList)
    .where(eq(allowList.email, email))
    .limit(1);
}

export async function getAllAllowList() {
  "use cache";
  cacheTag("allow-list");
  cacheLife("days");
  return await db.select().from(allowList);
}

export async function addToAllowListQuery(email: string) {
  return await db.insert(allowList).values({ email });
}

export async function removeFromAllowListQuery(id: string) {
  return await db.delete(allowList).where(eq(allowList.id, id));
}

export async function updateUserToRegistered(userId: string, email: string) {
  return await db
    .update(user)
    .set({
      email,
      isAnonymous: false,
    })
    .where(eq(user.id, userId));
}

export async function findPasskeyByName(name: string) {
  return await db.select().from(passkey).where(eq(passkey.name, name)).limit(1);
}

export async function findUserByEmail(email: string) {
  return await db.select().from(user).where(eq(user.email, email)).limit(1);
}

// -- AI/Embedding Queries --
export async function findRelevantContentQuery(
  similarity: SQL<number>,
  limit = 4,
  threshold = 0.5,
) {
  return await db
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
  epIndex: number,
  metadataKey: string,
) {
  return await db
    .select({
      metadata: episodeMetadataCache.metadata,
      resourceUrl: episodeMetadataCache.resourceUrl,
    })
    .from(episodeMetadataCache)
    .where(
      and(
        eq(episodeMetadataCache.sourceId, sourceId),
        eq(episodeMetadataCache.videoId, videoId),
        eq(episodeMetadataCache.epIndex, epIndex),
        eq(episodeMetadataCache.metadataKey, metadataKey),
      ),
    )
    .limit(1);
}

export async function upsertEpisodeMetadataCacheQuery(data: {
  sourceId: string;
  videoId: string;
  epIndex: number;
  metadataKey: string;
  resourceUrl?: string | null;
  metadata: Record<string, unknown>;
}) {
  const existing = await db
    .select({ id: episodeMetadataCache.id })
    .from(episodeMetadataCache)
    .where(
      and(
        eq(episodeMetadataCache.sourceId, data.sourceId),
        eq(episodeMetadataCache.videoId, data.videoId),
        eq(episodeMetadataCache.epIndex, data.epIndex),
        eq(episodeMetadataCache.metadataKey, data.metadataKey),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return await db
      .update(episodeMetadataCache)
      .set({
        resourceUrl: data.resourceUrl ?? null,
        metadata: data.metadata,
      })
      .where(eq(episodeMetadataCache.id, existing[0].id));
  }

  return await db.insert(episodeMetadataCache).values({
    sourceId: data.sourceId,
    videoId: data.videoId,
    epIndex: data.epIndex,
    metadataKey: data.metadataKey,
    resourceUrl: data.resourceUrl ?? null,
    metadata: data.metadata,
  });
}
