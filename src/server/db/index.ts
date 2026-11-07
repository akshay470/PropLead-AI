import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Cache database client across hot reloads in development
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

export type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Lazily creates and returns the Drizzle database instance.
 * Does not establish a connection or parse DATABASE_URL at module import time.
 * If DATABASE_URL is missing, throws a clear error naming the variable (never the value).
 * Has zero silent fallback to localhost.
 */
export function getDb(): DatabaseInstance {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "❌ Error: DATABASE_URL is missing or empty.\n" +
      "Hint: Set DATABASE_URL in .env.local (see .env.example)"
    );
  }

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

  if (process.env.NODE_ENV !== "production") {
    globalForDb.conn = client;
  }

  const instance = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.db = instance;
  }

  return instance;
}

/**
 * Lazy proxy representing the database instance.
 * Accessing query builder methods triggers getDb() on first query execution.
 * Avoids resolving thenables or React symbols during Webpack module bundling.
 */
export const db: DatabaseInstance = new Proxy({} as DatabaseInstance, {
  get(_target, prop, receiver) {
    if (
      prop === "then" ||
      prop === "$$typeof" ||
      prop === "__esModule" ||
      prop === "toJSON" ||
      prop === "valueOf" ||
      prop === "toString" ||
      prop === "constructor" ||
      typeof prop === "symbol"
    ) {
      return undefined;
    }
    const realDb = getDb();
    const val = Reflect.get(realDb, prop, receiver);
    if (typeof val === "function") {
      return val.bind(realDb);
    }
    return val;
  },
});

export { schema };
