import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireRegisteredUser() {
  const session = await getCurrentSession();

  if (!session?.user || session.user.isAnonymous) {
    throw new UnauthorizedError();
  }

  return session.user;
}
