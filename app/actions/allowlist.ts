"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { allowList } from "@/lib/db/auth-schema";
import { db } from "@/lib/db/queries";

async function checkPermission() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.isAnonymous) {
    throw new Error(
      "Unauthorized: Only registered users can manage the allowlist.",
    );
  }
}

export async function getAllowList() {
  await checkPermission();
  return await db.select().from(allowList);
}

export type ActionState = {
  success: boolean;
  error?: string;
  timestamp: number;
};

export async function addToAllowList(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await checkPermission();

  const email = formData.get("email") as string;
  if (!email) {
    return {
      success: false,
      error: "Email is required",
      timestamp: Date.now(),
    };
  }

  try {
    const id = crypto.randomUUID();
    await db.insert(allowList).values({
      id,
      email: email.toLowerCase(),
    });

    refresh();
    return { success: true, timestamp: Date.now() };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add to allowlist",
      timestamp: Date.now(),
    };
  }
}

export async function removeFromAllowList(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await checkPermission();

  const id = formData.get("id") as string;
  if (!id) {
    return {
      success: false,
      error: "ID is required",
      timestamp: Date.now(),
    };
  }

  try {
    await db.delete(allowList).where(eq(allowList.id, id));

    refresh();
    return { success: true, timestamp: Date.now() };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove from allowlist",
      timestamp: Date.now(),
    };
  }
}
