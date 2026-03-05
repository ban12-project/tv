"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/queries";
import { watchHistory } from "@/lib/db/schema";

const progressSchema = z.object({
  videoId: z.string().min(1),
  sourceId: z.string().min(1),
  epIndex: z.number().int().min(0),
  progress: z.number().min(0),
  duration: z.number().min(0),
});

export async function saveWatchProgress(payload: {
  videoId: string;
  sourceId: string;
  epIndex: number;
  progress: number;
  duration: number;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const validated = progressSchema.safeParse(payload);
  if (!validated.success) {
    return { success: false, error: "Invalid payload" };
  }

  try {
    const { videoId, sourceId, epIndex, progress, duration } = validated.data;

    // Check if a record already exists
    const existing = await db
      .select({ id: watchHistory.id })
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.userId, session.user.id),
          eq(watchHistory.videoId, videoId),
          eq(watchHistory.sourceId, sourceId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(watchHistory)
        .set({
          epIndex,
          progress: Math.floor(progress),
          duration: Math.floor(duration),
        })
        .where(eq(watchHistory.id, existing[0].id));
    } else {
      await db.insert(watchHistory).values({
        userId: session.user.id,
        videoId,
        sourceId,
        epIndex,
        progress: Math.floor(progress),
        duration: Math.floor(duration),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[saveWatchProgress] Error:", error);
    return { success: false, error: "Failed to save progress" };
  }
}

export async function getWatchProgress(videoId: string, sourceId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  try {
    const records = await db
      .select({
        epIndex: watchHistory.epIndex,
        progress: watchHistory.progress,
        duration: watchHistory.duration,
      })
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.userId, session.user.id),
          eq(watchHistory.videoId, videoId),
          eq(watchHistory.sourceId, sourceId),
        ),
      )
      .limit(1);

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error("[getWatchProgress] Error:", error);
    return null;
  }
}
