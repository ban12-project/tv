"use server";

import { cacheTag, updateTag } from "next/cache";
import * as z from "zod";
import { requireRegisteredUser } from "@/lib/auth-utils";
import {
  createApiSourceQuery,
  deleteApiSourceQuery,
  getApiSourcesQuery,
  updateApiSourceQuery,
} from "@/lib/db/queries";
import { hasCmsAdmin, hasDatabase, parseEnvCmsSources } from "@/lib/features";

type ActionState = {
  success: boolean;
  error?: string;
};

export async function getApiSources() {
  "use cache";
  cacheTag("api-sources");
  if (!hasDatabase()) {
    return parseEnvCmsSources();
  }
  return await getApiSourcesQuery();
}

const schema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  url: z.url(),
  type: z.enum(["json", "xml", "csv"]),
});

export async function createApiSource(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!hasCmsAdmin()) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  try {
    await requireRegisteredUser();
  } catch {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const validatedFields = schema.omit({ id: true }).safeParse({
    name: formData.get("name") as string,
    url: formData.get("url") as string,
    type: (formData.get("type") as string) || "json",
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: "INVALID_SOURCE",
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
  } catch {
    return {
      success: false,
      error: "CREATE_FAILED",
    };
  }
}

export async function updateApiSource(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!hasCmsAdmin()) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  try {
    await requireRegisteredUser();
  } catch {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const validatedFields = schema.safeParse({
    name: formData.get("name") as string,
    url: formData.get("url") as string,
    type: formData.get("type") as string,
    id: formData.get("id") as string,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: "INVALID_SOURCE",
    };
  }

  const { name, url, type, id } = validatedFields.data;

  try {
    await updateApiSourceQuery(id, {
      name,
      url,
      type,
    });
    updateTag("api-sources");
    return { success: true };
  } catch {
    return { success: false, error: "UPDATE_FAILED" };
  }
}

export async function deleteApiSource(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!hasCmsAdmin()) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  try {
    await requireRegisteredUser();
  } catch {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const validatedFields = schema.pick({ id: true }).safeParse({
    id: formData.get("id") as string,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: "INVALID_SOURCE",
    };
  }

  const { id } = validatedFields.data;
  if (!id) {
    return { success: false, error: "INVALID_SOURCE" };
  }

  try {
    await deleteApiSourceQuery(id);
    updateTag("api-sources");
    updateTag("recommendations");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "DELETE_FAILED",
    };
  }
}
