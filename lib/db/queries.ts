import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const sql = neon(process.env.DATABASE_URL);

import * as schema from "./schema";

export const db = drizzle({ client: sql, schema });

import { and, desc, eq } from "drizzle-orm";
import { allowList, apiSource, passkey, recommendations, user } from "./schema";
// -- CMS Queries --

export async function getApiSourcesQuery() {
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
