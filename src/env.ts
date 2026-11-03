import { z } from "zod";

/**
 * Validates environment variables at application startup.
 * Fails fast with clear error messages naming missing variables (names only, never values).
 */
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default(
      process.env.DATABASE_URL ||
        (isBuildPhase || process.env.NODE_ENV !== "production"
          ? "postgres://postgres:postgres@localhost:5432/proplead_ai"
          : "")
    ),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long")
    .default(
      process.env.JWT_SECRET ||
        (isBuildPhase || process.env.NODE_ENV !== "production"
          ? "proplead_ai_super_secret_development_key_minimum_32_bytes"
          : "")
    ),
  CRON_SECRET: z
    .string()
    .min(16, "CRON_SECRET must be at least 16 characters long")
    .default(
      process.env.CRON_SECRET ||
        (isBuildPhase || process.env.NODE_ENV !== "production"
          ? "demo_cron_secret_minimum_32_bytes"
          : "")
    ),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LLM_PROVIDER: z.enum(["mock", "gemini", "google"]).default("mock"),
  LLM_API_KEY: z.string().optional().default(""),
  LLM_MODEL: z.string().default("gemini-1.5-flash"),
  APP_URL: z.string().optional().default(""),
  ALLOW_SEED: z.string().optional().default(""),
  NEXT_PUBLIC_DEMO_MODE: z.string().optional().default("true"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const missingKeys = Object.keys(parsed.error.flatten().fieldErrors);
    console.error(
      `❌ [CRITICAL] Environment variable validation failed. Missing or invalid variables: ${missingKeys.join(
        ", "
      )}`
    );
    throw new Error(
      `Startup aborted: Missing or invalid environment variables: ${missingKeys.join(
        ", "
      )}. (Check .env.example)`
    );
  }

  return parsed.data;
}

export const env = validateEnv();
