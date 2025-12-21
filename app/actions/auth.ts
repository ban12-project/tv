"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import * as z from "zod";
import { auth } from "@/lib/auth";
import { allowList, passkey, user } from "@/lib/db/auth-schema";
import { db } from "@/lib/db/queries";

const schema = z.object({
  email: z.email(),
});

export async function preUpgradeAnonymous(email: string) {
  const validatedFields = schema.safeParse({ email });
  if (!validatedFields.success) {
    throw new Error("Invalid email address.");
  }
  const normalizedEmail = validatedFields.data.email.toLowerCase();

  // 1. Check if email is in allowlist
  const allowed = await db
    .select()
    .from(allowList)
    .where(eq(allowList.email, normalizedEmail))
    .limit(1);

  if (allowed.length === 0) {
    throw new Error("This email is not in the allowlist.");
  }

  // 2. Get current session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("No active session found.");
  }

  if (!session.user.isAnonymous) {
    throw new Error("You are already a registered user.");
  }

  // 3. Update the user record
  // We set email and isAnonymous = false
  await db
    .update(user)
    .set({
      email: normalizedEmail,
      isAnonymous: false,
    })
    .where(eq(user.id, session.user.id));

  return { success: true };
}

export async function checkEmail(email: string) {
  const validatedFields = schema.safeParse({ email });
  if (!validatedFields.success) {
    throw new Error("Invalid email address.");
  }
  const normalizedEmail = validatedFields.data.email.toLowerCase();

  const allowed = await db
    .select()
    .from(allowList)
    .where(eq(allowList.email, normalizedEmail))
    .limit(1);

  return allowed.length > 0;
}

export async function checkRegistrationStatus(email: string) {
  const validatedFields = schema.safeParse({ email });
  if (!validatedFields.success) {
    throw new Error("Invalid email address.");
  }
  const normalizedEmail = validatedFields.data.email.toLowerCase();

  // 1. Check if a passkey exists with this name (email)
  const existingPasskey = await db
    .select()
    .from(passkey)
    .where(eq(passkey.name, normalizedEmail))
    .limit(1);

  if (existingPasskey.length > 0) {
    return { registered: true };
  }

  // 2. Check if a non-anonymous user exists with this email
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  if (existingUser.length > 0 && !existingUser[0].isAnonymous) {
    return { registered: true };
  }

  return { registered: false };
}
