import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { passkey } from "./auth-schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle({ client });

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
