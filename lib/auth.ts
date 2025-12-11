import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import * as schema from "./db/auth-schema";
import { db } from "./db/queries";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [
    passkey(),
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log("anonymousUser", anonymousUser);
        console.log("newUser", newUser);
      },
    }),
  ],
});
