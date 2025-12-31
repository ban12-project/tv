"use server";

import { and, desc, eq } from "drizzle-orm";
import { cacheTag, revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/queries";
import { recommendations } from "@/lib/db/schema";

export type ActionState = {
  success: boolean;
  error?: string | Record<string, string[]>;
};

const recommendationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  image: z.url("Image must be a valid URL"),
  sourceId: z.string().optional(),
  videoId: z.string().optional(),
  epIndex: z.string().optional(),
});

export async function saveRecommendation(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be logged in to recommend.",
    };
  }

  const validatedFields = recommendationSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    image: formData.get("image"),
    sourceId: formData.get("sourceId"),
    videoId: formData.get("videoId"),
    epIndex: formData.get("epIndex"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: z.prettifyError(validatedFields.error),
    };
  }

  const { title, description, image, sourceId, videoId, epIndex } =
    validatedFields.data;

  try {
    // Check for existing recommendation
    const existing = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.userId, session.user.id),
          sourceId
            ? and(
                eq(recommendations.sourceId, sourceId),
                eq(recommendations.videoId, videoId || ""),
              )
            : undefined,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "You have already recommended this video.",
      };
    }

    await db.insert(recommendations).values({
      title,
      description,
      image,
      sourceId: sourceId || null,
      videoId: videoId || null,
      epIndex: epIndex || null,
      userId: session.user.id,
    });

    updateTag("recommendations");
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to save recommendation:", error);
    return {
      success: false,
      error: "Failed to save recommendation. Please try again.",
    };
  }
}

export async function deleteRecommendation(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  const sourceId = formData.get("sourceId") as string;
  const videoId = formData.get("videoId") as string;

  try {
    await db
      .delete(recommendations)
      .where(
        and(
          eq(recommendations.userId, session.user.id),
          eq(recommendations.sourceId, sourceId),
          eq(recommendations.videoId, videoId),
        ),
      );

    updateTag("recommendations");
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete recommendation:", error);
    return {
      success: false,
      error: "Failed to delete recommendation.",
    };
  }
}

// Helper to check if a user has recommended a video
export async function checkIsRecommended(
  sourceId: string,
  videoId: string,
): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return false;
  }

  const existing = await db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.userId, session.user.id),
        eq(recommendations.sourceId, sourceId),
        eq(recommendations.videoId, videoId),
      ),
    )
    .limit(1);

  return existing.length > 0;
}

export async function getRecommendations(limit = 6) {
  "use cache";
  cacheTag("recommendations");

  return await db
    .select()
    .from(recommendations)
    .orderBy(desc(recommendations.createdAt))
    .limit(limit);
}
