/**
 * Safely extracts the database host from a connection string.
 * Returns host/domain/IP only, never credentials, port, path, or query params.
 */
export function extractDatabaseHost(connectionString?: string): string {
  if (!connectionString) return "unknown";
  try {
    const url = new URL(connectionString);
    const rawHost = url.hostname || "unknown";
    return rawHost.replace(/^\[|\]$/g, "");
  } catch {
    const match = connectionString.match(/@([^:/?#]+)/);
    const rawMatch = match ? match[1] : "unknown";
    return rawMatch.replace(/^\[|\]$/g, "");
  }
}

export interface SeedGuardParams {
  databaseUrl?: string;
  allowSeed?: string;
  allowLocalSeed?: string;
}

export interface SeedGuardResult {
  host: string;
}

/**
 * Validates the database environment before any tables or data are deleted or modified.
 * - Refuses to reset tables unless ALLOW_SEED=true
 * - Refuses when the host is localhost/127.0.0.1 unless ALLOW_LOCAL_SEED=true
 */
export function assertCanSeed(params: SeedGuardParams): SeedGuardResult {
  const { databaseUrl, allowSeed, allowLocalSeed } = params;

  if (!databaseUrl?.trim()) {
    throw new Error(
      "❌ Error: DATABASE_URL is missing.\nHint: Set DATABASE_URL in .env.local (see .env.example)"
    );
  }

  const host = extractDatabaseHost(databaseUrl);

  if (allowSeed !== "true") {
    throw new Error(
      "❌ Error: Seeding database requires ALLOW_SEED=true in environment variables.\n" +
      "Hint: Set ALLOW_SEED=true in .env.local (see .env.example)"
    );
  }

  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host === "0.0.0.0";

  if (isLocalHost && allowLocalSeed !== "true") {
    throw new Error(
      `❌ Error: Refusing to seed local database (${host}) because ALLOW_LOCAL_SEED is not 'true'.\n` +
      "Hint: If you intentionally want to seed a local database instance, set ALLOW_LOCAL_SEED=true."
    );
  }

  return { host };
}
