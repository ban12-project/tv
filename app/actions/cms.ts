"use server";

import { eq } from "drizzle-orm";
import { cacheTag, updateTag } from "next/cache";
import * as z from "zod";
import { db } from "@/lib/db/queries";
import { apiSource } from "@/lib/db/schema";

type ActionState = {
  success: boolean;
  error?: string;
};

export async function getApiSources() {
  "use cache";
  cacheTag("api-sources");
  return await db.select().from(apiSource).orderBy(apiSource.createdAt);
}

const schema = z.object({
  id: z.uuid(),
  name: z.string().min(1, "Name is required"),
  url: z.url("Must be a valid URL"),
  type: z.enum(["json", "xml", "csv"]),
});

export async function createApiSource(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const validatedFields = schema.omit({ id: true }).safeParse({
    name: formData.get("name") as string,
    url: formData.get("url") as string,
    type: (formData.get("type") as string) || "json",
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: z.prettifyError(validatedFields.error),
    };
  }

  const { name, url, type } = validatedFields.data;

  try {
    await db.insert(apiSource).values({
      name,
      url,
      type,
    });
    updateTag("api-sources");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create source",
    };
  }
}

export async function updateApiSource(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const validatedFields = schema.safeParse({
    name: formData.get("name") as string,
    url: formData.get("url") as string,
    type: formData.get("type") as string,
    id: formData.get("id") as string,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: z.prettifyError(validatedFields.error),
    };
  }

  const { name, url, type, id } = validatedFields.data;

  db.update(apiSource)
    .set({
      name,
      url,
      type,
    })
    .where(eq(apiSource.id, id));
  updateTag("api-sources");
  return { success: true };
}

export async function deleteApiSource(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const validatedFields = schema.pick({ id: true }).safeParse({
    id: formData.get("id") as string,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: z.prettifyError(validatedFields.error),
    };
  }

  const { id } = validatedFields.data;
  if (!id) {
    return { success: false, error: "ID is required" };
  }

  try {
    await db.delete(apiSource).where(eq(apiSource.id, id));
    updateTag("api-sources");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete source",
    };
  }
}
