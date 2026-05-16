import "server-only";

import { z } from "zod";
import { upsertWatchProgressQuery } from "@/lib/db/queries";
import { hasDatabase } from "@/lib/features";

export const watchProgressSchema = z.object({
  videoId: z.string().min(1),
  sourceId: z.string().min(1),
  epIndex: z.number().int().min(0),
  progress: z.number().min(0),
  duration: z.number().min(0),
});

export type WatchProgressInput = z.infer<typeof watchProgressSchema>;

export async function upsertWatchProgressForUser(
  userId: string,
  payload: WatchProgressInput,
) {
  if (!hasDatabase()) {
    return null;
  }

  return upsertWatchProgressQuery({
    userId,
    videoId: payload.videoId,
    sourceId: payload.sourceId,
    epIndex: payload.epIndex,
    progress: payload.progress,
    duration: payload.duration,
  });
}
