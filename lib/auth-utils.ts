import "server-only";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { hasAuth } from "@/lib/features";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function getCurrentSession() {
  if (!hasAuth()) return null;

  return getAuth().api.getSession({
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
