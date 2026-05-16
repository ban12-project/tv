"use server";

import { cacheTag, revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentSession, requireRegisteredUser } from "@/lib/auth-utils";
import {
  createRecommendationQuery,
  deleteRecommendationQuery,
  findRecommendation,
  findRecommendationByVideoId,
  getRecommendationsQuery,
} from "@/lib/db/queries";

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
  let user: Awaited<ReturnType<typeof requireRegisteredUser>>;
  try {
    user = await requireRegisteredUser();
  } catch {
    return {
      success: false,
      error: "UNAUTHORIZED",
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
      error: "INVALID_RECOMMENDATION",
    };
  }

  const { title, description, image, sourceId, videoId, epIndex } =
    validatedFields.data;

  try {
    // Check for existing recommendation
    const existing = await findRecommendation(user.id, sourceId, videoId);

    if (existing.length > 0) {
      return {
        success: false,
        error: "DUPLICATE_RECOMMENDATION",
      };
    }

    await createRecommendationQuery({
      title,
      description,
      image,
      sourceId: sourceId || null,
      videoId: videoId || null,
      epIndex: epIndex || null,
      userId: user.id,
    });

    updateTag("recommendations");
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to save recommendation:", error);
    return {
      success: false,
      error: "SAVE_RECOMMENDATION_FAILED",
    };
  }
}

export async function deleteRecommendation(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let user: Awaited<ReturnType<typeof requireRegisteredUser>>;
  try {
    user = await requireRegisteredUser();
  } catch {
    return {
      success: false,
      error: "UNAUTHORIZED",
    };
  }

  const sourceId = formData.get("sourceId") as string;
  const videoId = formData.get("videoId") as string;

  try {
    await deleteRecommendationQuery(user.id, sourceId, videoId);

    updateTag("recommendations");
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete recommendation:", error);
    return {
      success: false,
      error: "DELETE_RECOMMENDATION_FAILED",
    };
  }
}

// Helper to check if a user has recommended a video
export async function checkIsRecommended(
  sourceId: string,
  videoId: string,
): Promise<boolean> {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return false;
  }

  const existing = await findRecommendation(session.user.id, sourceId, videoId);

  return existing.length > 0;
}

export async function getRecommendations(limit = 6) {
  "use cache";
  cacheTag("recommendations");

  return await getRecommendationsQuery(limit);
}

export async function getRecommendedVideoTitle(
  sourceId: string,
  videoId: string,
) {
  const recommendations = await findRecommendationByVideoId(sourceId, videoId);
  return recommendations.length > 0 ? recommendations[0].title : null;
}
