import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/env";

// Cache database client across hot reloads in development
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const connectionString = env.DATABASE_URL;
const requiresSsl =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("sslmode=verify-full") ||
  connectionString.includes("ssl=true") ||
  connectionString.includes("ssl=require");

const client =
  globalForDb.conn ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: requiresSsl ? "require" : undefined,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.conn = client;
}

export const db = drizzle(client, { schema });
export { schema };
