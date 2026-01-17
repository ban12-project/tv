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

// -- Auth/Allowlist Queries --
export async function findAllowlistByEmail(email: string) {
  return await db
    .select()
    .from(allowList)
    .where(eq(allowList.email, email))
    .limit(1);
}

export async function getAllAllowList() {
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
  similarityCol: SQL<number>,
  limit = 4,
  threshold = 0.5,
) {
  "use cache";
  // We can't easily cache the *result* based on a dynamic similarity column unless we serialize it,
  // but "use cache" is for the function output.
  // Actually, keeping strict caching for *search* might be tricky if the input is high-cardinality.
  // However, per instructions: "All asynchronous IO operations... MUST use the 'use cache' directive."
  // For vector search, specific inputs might not repeat often, but we should adhere to the rule.
  // Let's defer strict caching on this specific dynamic query if it depends on exact user input,
  // or use cacheTag if possible?
  // The instruction says: "that do not depend on runtime parameters (cookies, headers, searchParams)".
  // User query IS a runtime parameter usually (search param).
  // So strictly speaking it might NOT need 'use cache' if it depends on searchParams.
  // BUT `generateEmbedding` usually comes from user input.
  // Let's enable it for "static-like" data first.

  // Wait, `findRelevantContent` depends on `userQuery`.
  // If `userQuery` comes from searchParams/input, we might skip `use cache` for this specific dynamic search
  // OR use it with a short lifetime + tag.
  // Let's implement the function first.
  return await db
    .select({ name: resources.content, similarity: similarityCol })
    .from(embeddings)
    .leftJoin(resources, eq(embeddings.resourceId, resources.id))
    .where(gt(similarityCol, threshold))
    .orderBy(desc(similarityCol))
    .limit(limit);
}
