"use server";

import { eq } from "drizzle-orm";
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

export async function addToAllowList(email: string) {
  await checkPermission();

  const id = crypto.randomUUID();
  await db.insert(allowList).values({
    id,
    email: email.toLowerCase(),
  });

  return { success: true };
}

export async function removeFromAllowList(id: string) {
  await checkPermission();

  await db.delete(allowList).where(eq(allowList.id, id));

  return { success: true };
}
