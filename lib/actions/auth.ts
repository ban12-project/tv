"use server";

import { headers } from "next/headers";
import * as z from "zod";
import { auth } from "@/lib/auth";
import {
  findAllowlistByEmail,
  findPasskeyByName,
  findUserByEmail,
  updateUserToRegistered,
} from "@/lib/db/queries";

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
  const allowed = await findAllowlistByEmail(normalizedEmail);

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
  await updateUserToRegistered(session.user.id, normalizedEmail);

  return { success: true };
}

export async function checkRegistrationStatus(email: string) {
  const validatedFields = schema.safeParse({ email });
  if (!validatedFields.success) {
    throw new Error("Invalid email address.");
  }
  const normalizedEmail = validatedFields.data.email.toLowerCase();

  // 1. Check Allowlist
  const allowed = await findAllowlistByEmail(normalizedEmail);

  if (allowed.length === 0) {
    return { allowed: false, registered: false };
  }

  // 2. Check Passkey
  const existingPasskey = await findPasskeyByName(normalizedEmail);

  if (existingPasskey.length > 0) {
    return { allowed: true, registered: true };
  }

  // 3. Check User
  const existingUser = await findUserByEmail(normalizedEmail);

  const isRegistered = existingUser.length > 0 && !existingUser[0].isAnonymous;

  return { allowed: true, registered: isRegistered };
}
