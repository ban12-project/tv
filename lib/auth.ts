import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { getDb } from "./db/queries";
import * as schema from "./db/schema/auth-schema";
import { hasAuth } from "./features";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
    }),
    plugins: [passkey(), anonymous()],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

let authInstance: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!hasAuth()) {
    throw new Error("Authentication is not configured.");
  }

  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
}
