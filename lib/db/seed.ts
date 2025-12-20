import { neon } from "@neondatabase/serverless";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { passkey } from "./auth-schema";

if (!process.env.DIRECT_DATABASE_URL) {
  throw new Error("DIRECT_DATABASE_URL is not defined");
}

const sql = neon(process.env.DIRECT_DATABASE_URL);
const db = drizzle({ client: sql });

async function main() {
  const record = await db
    .select()
    .from(passkey)
    .orderBy(desc(passkey.createdAt))
    .limit(1);

  console.log(record);

  console.log("done");
}

main();
