"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import {
  addToAllowListQuery,
  getAllAllowList,
  removeFromAllowListQuery,
} from "@/lib/db/queries";
import { hasAuth } from "@/lib/features";

async function checkPermission() {
  if (!hasAuth()) {
    throw new Error(
      "Unauthorized: Only registered users can manage the allowlist.",
    );
  }

  const session = await getAuth().api.getSession({
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
  return await getAllAllowList();
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
    await addToAllowListQuery(email.toLowerCase());

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
    await removeFromAllowListQuery(id);

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
