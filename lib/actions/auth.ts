"use server";

import * as z from "zod";
import {
  findAllowlistByEmail,
  findPasskeyRegistrationByName,
  findUserByEmail,
} from "@/lib/db/queries";

const schema = z.object({
  email: z.email(),
});

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

  // 2. Check Passkey owner, not just passkey presence. A failed legacy
  // anonymous upgrade can leave an anonymous user with a named passkey.
  const existingPasskey = await findPasskeyRegistrationByName(normalizedEmail);

  if (existingPasskey.some((row) => row.isAnonymous === false)) {
    return { allowed: true, registered: true };
  }

  // 3. Check User
  const existingUser = await findUserByEmail(normalizedEmail);

  const isRegistered =
    existingUser.length > 0 && existingUser[0].isAnonymous === false;

  return { allowed: true, registered: isRegistered };
}
