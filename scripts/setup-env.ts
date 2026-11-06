import fs from "fs";
import path from "path";
import crypto from "crypto";

const envLocalPath = path.resolve(process.cwd(), ".env.local");

let existing: Record<string, string> = {};
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      existing[key] = val;
    }
  });
}

function getValue(key: string, defaultValue: string | (() => string)): string {
  const val = existing[key];
  if (val && val !== "" && val !== '""' && val !== "''") {
    return val;
  }
  return typeof defaultValue === "function" ? defaultValue() : defaultValue;
}

// Cryptographically generated secrets if empty
const jwtSecret = getValue("JWT_SECRET", () => crypto.randomBytes(36).toString("hex")); // 72 chars
const cronSecret = getValue("CRON_SECRET", () => crypto.randomBytes(24).toString("hex")); // 48 chars

// Non-secret defaults
const databaseUrl = getValue("DATABASE_URL", "");
const llmApiKey = getValue("LLM_API_KEY", "");
const llmProvider = getValue("LLM_PROVIDER", "gemini");
const llmModel = getValue("LLM_MODEL", "gemini-3.5-flash-lite");
const demoMode = getValue("NEXT_PUBLIC_DEMO_MODE", "true");
const allowSeed = getValue("ALLOW_SEED", "true");
const testDbUrl = getValue("TEST_DATABASE_URL", "");
const appUrl = getValue("APP_URL", "http://localhost:3000");
const nodeEnv = getValue("NODE_ENV", "development");

const newContent = [
  "# Paste your Neon connection string here",
  `DATABASE_URL=${databaseUrl}`,
  "",
  "# Secret key for signing session JWT cookies (cryptographically generated)",
  `JWT_SECRET=${jwtSecret}`,
  "",
  "# Shared secret token for authenticating automated reminder cron invocations (cryptographically generated)",
  `CRON_SECRET=${cronSecret}`,
  "",
  '# AI LLM provider selection ("mock" for deterministic offline tests, "gemini" for live Google Gemini)',
  `LLM_PROVIDER=${llmProvider}`,
  "",
  "# Google Gemini model identifier",
  `LLM_MODEL=${llmModel}`,
  "",
  "# Paste your Gemini API key here",
  `LLM_API_KEY=${llmApiKey}`,
  "",
  "# Public flag enabling pre-filled reviewer credentials on login screen",
  `NEXT_PUBLIC_DEMO_MODE=${demoMode}`,
  "",
  "# Safety guard flag allowing database seed script to execute",
  `ALLOW_SEED=${allowSeed}`,
  "",
  "# Optional PostgreSQL connection URL to run multi-connection pool concurrency tests",
  `TEST_DATABASE_URL=${testDbUrl}`,
  "",
  "# Canonical application URL used for calendar .ics and notification links",
  `APP_URL=${appUrl}`,
  "",
  "# Application environment",
  `NODE_ENV=${nodeEnv}`,
  "",
].join("\n");

fs.writeFileSync(envLocalPath, newContent, "utf-8");
console.log("✅ Successfully configured .env.local without exposing any secrets.");
