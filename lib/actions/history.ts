"use server";

import { and, eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth-utils";
import { db } from "@/lib/db/queries";
import { watchHistory } from "@/lib/db/schema";
import {
  upsertWatchProgressForUser,
  watchProgressSchema,
} from "@/lib/watch-history";

export async function saveWatchProgress(payload: {
  videoId: string;
  sourceId: string;
  epIndex: number;
  progress: number;
  duration: number;
}) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.isAnonymous) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const validated = watchProgressSchema.safeParse(payload);
  if (!validated.success) {
    return { success: false, error: "Invalid payload" };
  }

  try {
    await upsertWatchProgressForUser(session.user.id, validated.data);

    return { success: true };
  } catch (error) {
    console.error("[saveWatchProgress] Error:", error);
    return { success: false, error: "Failed to save progress" };
  }
}

export async function getWatchProgress(videoId: string, sourceId: string) {
  const session = await getCurrentSession();
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
