import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hasDatabase } from "@/lib/features";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!hasDatabase() || !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!dbInstance) {
    const neonSql = neon(process.env.DATABASE_URL);
    dbInstance = drizzle({ client: neonSql, schema });
  }

  return dbInstance;
}
