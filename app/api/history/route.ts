import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    let payload: unknown;

    // sendBeacon sends text/plain or application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      // fallback for sendBeacon
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
      }
    }

    const validated = progressSchema.safeParse(payload);
    if (!validated.success) {
      return new NextResponse("Invalid payload", { status: 400 });
    }

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

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[api/history/route.ts] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
