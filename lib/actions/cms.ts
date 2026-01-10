"use server";

import { cacheTag, updateTag } from "next/cache";
import * as z from "zod";
import {
  createApiSourceQuery,
  deleteApiSourceQuery,
  getApiSourcesQuery,
  updateApiSourceQuery,
} from "@/lib/db/queries";

type ActionState = {
  success: boolean;
  error?: string;
};

export async function getApiSources() {
  "use cache";
  cacheTag("api-sources");
  return await getApiSourcesQuery();
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
    await createApiSourceQuery({
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

  await updateApiSourceQuery(id, {
    name,
    url,
    type,
  });
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
    await deleteApiSourceQuery(id);
    updateTag("api-sources");
    updateTag("recommendations");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete source",
    };
  }
}
