import { describe, it, expect, vi } from "vitest";

function validateDatabaseUrl(databaseUrl?: string, nodeEnv?: string): { error?: string; hint?: string } | null {
  const isTest = nodeEnv === "test";
  if (!isTest) {
    if (!databaseUrl || databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
      return {
        error: "❌ Error: DATABASE_URL is missing or points to localhost/127.0.0.1.",
        hint: "Set DATABASE_URL in .env.local (see .env.example)",
      };
    }
  }
  return null;
}

describe("DATABASE_URL Environment Validation Guard", () => {
  it("should reject missing DATABASE_URL with clear error and hint", () => {
    const result = validateDatabaseUrl(undefined, "development");
    expect(result).not.toBeNull();
    expect(result?.error).toContain("DATABASE_URL");
    expect(result?.hint).toBe("Set DATABASE_URL in .env.local (see .env.example)");
  });

  it("should reject localhost DATABASE_URL with clear error and hint", () => {
    const secretUrl = "postgres://supersecretuser:supersecretpass@localhost:5432/proplead";
    const result = validateDatabaseUrl(secretUrl, "development");
    expect(result).not.toBeNull();
    expect(result?.error).toContain("DATABASE_URL");
    // Ensure the secret value is NEVER printed in error or hint
    expect(result?.error).not.toContain("supersecretpass");
    expect(result?.hint).not.toContain("supersecretpass");
    expect(result?.hint).toBe("Set DATABASE_URL in .env.local (see .env.example)");
  });

  it("should reject 127.0.0.1 DATABASE_URL with clear error and hint", () => {
    const secretUrl = "postgres://admin:pass123@127.0.0.1:5432/proplead";
    const result = validateDatabaseUrl(secretUrl, "development");
    expect(result).not.toBeNull();
    expect(result?.error).toContain("DATABASE_URL");
    expect(result?.error).not.toContain("pass123");
    expect(result?.hint).toBe("Set DATABASE_URL in .env.local (see .env.example)");
  });

  it("should allow remote Neon database URL", () => {
    const remoteUrl = "postgres://user:pass@ep-cool-proj.us-east-2.aws.neon.tech/neondb?sslmode=require";
    const result = validateDatabaseUrl(remoteUrl, "development");
    expect(result).toBeNull();
  });

  it("should allow localhost or missing DATABASE_URL when NODE_ENV is test", () => {
    expect(validateDatabaseUrl(undefined, "test")).toBeNull();
    expect(validateDatabaseUrl("postgres://postgres:postgres@localhost:5432/db", "test")).toBeNull();
  });
});
