import { describe, it, expect } from "vitest";
import { checkEnvStatuses } from "../../scripts/check-env";

describe("Environment Configuration Status Checker (check:env)", () => {
  it("should report OK for fully valid remote configuration", () => {
    const validEnv = {
      DATABASE_URL: "postgres://user:pass@ep-cool.neon.tech/neondb?sslmode=require",
      JWT_SECRET: "this_is_a_very_long_cryptographic_secret_with_more_than_32_characters",
      CRON_SECRET: "cron_secret_minimum_16_characters_long",
      LLM_PROVIDER: "gemini",
      LLM_MODEL: "gemini-1.5-flash",
      LLM_API_KEY: "AIzaSyDummyKeyForTesting",
      NEXT_PUBLIC_DEMO_MODE: "true",
      ALLOW_SEED: "true",
      TEST_DATABASE_URL: "postgres://user:pass@ep-test.neon.tech/testdb?sslmode=require",
      APP_URL: "http://localhost:3000",
      NODE_ENV: "development",
    };

    const results = checkEnvStatuses(validEnv);
    expect(results.length).toBe(11);
    for (const item of results) {
      expect(item.status).toBe("OK");
    }
  });

  it("should report EMPTY for missing or empty variables", () => {
    const emptyEnv = {
      DATABASE_URL: "",
      JWT_SECRET: "",
      CRON_SECRET: "",
      LLM_PROVIDER: "",
      LLM_MODEL: "",
      LLM_API_KEY: "",
      NEXT_PUBLIC_DEMO_MODE: "",
      ALLOW_SEED: "",
      TEST_DATABASE_URL: "",
      APP_URL: "",
      NODE_ENV: "",
    };

    const results = checkEnvStatuses(emptyEnv);
    for (const item of results) {
      expect(item.status).toBe("EMPTY");
    }
  });

  it("should report INVALID for database pointing to localhost", () => {
    const localhostEnv = {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/proplead",
    };

    const results = checkEnvStatuses(localhostEnv);
    const dbItem = results.find((r) => r.name === "DATABASE_URL");
    expect(dbItem?.status).toBe("INVALID");
    expect(dbItem?.notes).toContain("localhost");
  });

  it("should report INVALID for database missing sslmode=require", () => {
    const noSslEnv = {
      DATABASE_URL: "postgres://user:pass@ep-cool.neon.tech/neondb",
    };

    const results = checkEnvStatuses(noSslEnv);
    const dbItem = results.find((r) => r.name === "DATABASE_URL");
    expect(dbItem?.status).toBe("INVALID");
    expect(dbItem?.notes).toContain("sslmode=require");
  });

  it("should report INVALID for short JWT_SECRET or CRON_SECRET", () => {
    const shortEnv = {
      JWT_SECRET: "too_short_secret", // < 32 chars
      CRON_SECRET: "short", // < 16 chars
    };

    const results = checkEnvStatuses(shortEnv);
    const jwtItem = results.find((r) => r.name === "JWT_SECRET");
    const cronItem = results.find((r) => r.name === "CRON_SECRET");

    expect(jwtItem?.status).toBe("INVALID");
    expect(jwtItem?.notes).toContain("32 characters");

    expect(cronItem?.status).toBe("INVALID");
    expect(cronItem?.notes).toContain("16 characters");
  });

  it("should report INVALID for invalid boolean flags and invalid provider", () => {
    const invalidEnv = {
      LLM_PROVIDER: "unknown-provider",
      ALLOW_SEED: "yes", // should be true or false
      NEXT_PUBLIC_DEMO_MODE: "enabled", // should be true or false
      APP_URL: "not-a-valid-url",
      NODE_ENV: "invalid_env",
    };

    const results = checkEnvStatuses(invalidEnv);

    expect(results.find((r) => r.name === "LLM_PROVIDER")?.status).toBe("INVALID");
    expect(results.find((r) => r.name === "ALLOW_SEED")?.status).toBe("INVALID");
    expect(results.find((r) => r.name === "NEXT_PUBLIC_DEMO_MODE")?.status).toBe("INVALID");
    expect(results.find((r) => r.name === "APP_URL")?.status).toBe("INVALID");
    expect(results.find((r) => r.name === "NODE_ENV")?.status).toBe("INVALID");
  });

  it("should never leak actual secret values in check results", () => {
    const secretPass = "SuperConfidentialPassphrase9876543210!";
    const testEnv = {
      DATABASE_URL: `postgres://user:${secretPass}@localhost:5432/db`,
      JWT_SECRET: `secret_${secretPass}`,
      CRON_SECRET: `cron_${secretPass}`,
      LLM_API_KEY: `key_${secretPass}`,
    };

    const results = checkEnvStatuses(testEnv);
    for (const item of results) {
      expect(item.notes).not.toContain(secretPass);
      expect(item.name).not.toContain(secretPass);
    }
  });
});
