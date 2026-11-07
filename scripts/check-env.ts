import "../src/server/env-load";
import fs from "fs";
import path from "path";

export type EnvStatus = "OK" | "EMPTY" | "INVALID";

export interface EnvCheckItem {
  name: string;
  status: EnvStatus;
  notes: string;
}

export function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

export function checkEnvStatuses(env: Record<string, string | undefined>): EnvCheckItem[] {
  const results: EnvCheckItem[] = [];

  // 1. DATABASE_URL
  const dbUrl = env.DATABASE_URL?.trim();
  if (!dbUrl) {
    results.push({
      name: "DATABASE_URL",
      status: "EMPTY",
      notes: "Required: Paste Neon connection string in .env.local",
    });
  } else if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
    results.push({
      name: "DATABASE_URL",
      status: "INVALID",
      notes: "Points to localhost; must be remote PostgreSQL (e.g. Neon)",
    });
  } else if (!dbUrl.includes("sslmode=require") && !dbUrl.includes("ssl=true")) {
    results.push({
      name: "DATABASE_URL",
      status: "INVALID",
      notes: "Missing sslmode=require for secure Neon connection",
    });
  } else {
    results.push({
      name: "DATABASE_URL",
      status: "OK",
      notes: "Configured with remote SSL",
    });
  }

  // 2. JWT_SECRET
  const jwt = env.JWT_SECRET?.trim();
  if (!jwt) {
    results.push({
      name: "JWT_SECRET",
      status: "EMPTY",
      notes: "Required for session signing",
    });
  } else if (jwt.length < 32) {
    results.push({
      name: "JWT_SECRET",
      status: "INVALID",
      notes: "Shorter than 32 characters",
    });
  } else {
    results.push({
      name: "JWT_SECRET",
      status: "OK",
      notes: "Configured (>= 32 chars)",
    });
  }

  // 3. CRON_SECRET
  const cron = env.CRON_SECRET?.trim();
  if (!cron) {
    results.push({
      name: "CRON_SECRET",
      status: "EMPTY",
      notes: "Required for automated reminder cron triggers",
    });
  } else if (cron.length < 16) {
    results.push({
      name: "CRON_SECRET",
      status: "INVALID",
      notes: "Shorter than 16 characters",
    });
  } else {
    results.push({
      name: "CRON_SECRET",
      status: "OK",
      notes: "Configured (>= 16 chars)",
    });
  }

  // 4. LLM_PROVIDER
  const provider = env.LLM_PROVIDER?.trim();
  if (!provider) {
    results.push({
      name: "LLM_PROVIDER",
      status: "EMPTY",
      notes: "Defaults to 'gemini' or 'mock'",
    });
  } else if (!["gemini", "mock", "google"].includes(provider)) {
    results.push({
      name: "LLM_PROVIDER",
      status: "INVALID",
      notes: "Must be 'gemini' or 'mock'",
    });
  } else {
    results.push({
      name: "LLM_PROVIDER",
      status: "OK",
      notes: `Configured ('${provider}')`,
    });
  }

  // 5. LLM_MODEL
  const model = env.LLM_MODEL?.trim();
  if (!model) {
    results.push({
      name: "LLM_MODEL",
      status: "EMPTY",
      notes: "Must be set in environment (e.g. gemini-3.5-flash-lite)",
    });
  } else {
    results.push({
      name: "LLM_MODEL",
      status: "OK",
      notes: `Configured ('${model}')`,
    });
  }

  // 6. LLM_API_KEY
  const apiKey = env.LLM_API_KEY?.trim();
  if (!apiKey) {
    results.push({
      name: "LLM_API_KEY",
      status: "EMPTY",
      notes: provider === "gemini" ? "Required when LLM_PROVIDER=gemini" : "Optional when LLM_PROVIDER=mock",
    });
  } else {
    results.push({
      name: "LLM_API_KEY",
      status: "OK",
      notes: "Configured",
    });
  }

  // 7. NEXT_PUBLIC_DEMO_MODE
  const demoMode = env.NEXT_PUBLIC_DEMO_MODE?.trim();
  if (!demoMode) {
    results.push({
      name: "NEXT_PUBLIC_DEMO_MODE",
      status: "EMPTY",
      notes: "Defaults to 'true'",
    });
  } else if (demoMode !== "true" && demoMode !== "false") {
    results.push({
      name: "NEXT_PUBLIC_DEMO_MODE",
      status: "INVALID",
      notes: "Must be 'true' or 'false'",
    });
  } else {
    results.push({
      name: "NEXT_PUBLIC_DEMO_MODE",
      status: "OK",
      notes: `Configured ('${demoMode}')`,
    });
  }

  // 8. ALLOW_SEED
  const allowSeed = env.ALLOW_SEED?.trim();
  if (!allowSeed) {
    results.push({
      name: "ALLOW_SEED",
      status: "EMPTY",
      notes: "Must be 'true' to allow pnpm run seed",
    });
  } else if (allowSeed !== "true" && allowSeed !== "false") {
    results.push({
      name: "ALLOW_SEED",
      status: "INVALID",
      notes: "Must be 'true' or 'false'",
    });
  } else {
    results.push({
      name: "ALLOW_SEED",
      status: "OK",
      notes: `Configured ('${allowSeed}')`,
    });
  }

  // 9. TEST_DATABASE_URL
  const testDb = env.TEST_DATABASE_URL?.trim();
  if (!testDb) {
    results.push({
      name: "TEST_DATABASE_URL",
      status: "EMPTY",
      notes: "Optional: Real PostgreSQL pool concurrency test URL",
    });
  } else {
    results.push({
      name: "TEST_DATABASE_URL",
      status: "OK",
      notes: "Configured",
    });
  }

  // 10. APP_URL
  const appUrl = env.APP_URL?.trim();
  if (!appUrl) {
    results.push({
      name: "APP_URL",
      status: "EMPTY",
      notes: "Optional: Defaults to http://localhost:3000",
    });
  } else if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
    results.push({
      name: "APP_URL",
      status: "INVALID",
      notes: "Must start with http:// or https://",
    });
  } else {
    results.push({
      name: "APP_URL",
      status: "OK",
      notes: "Configured",
    });
  }

  // 11. NODE_ENV
  const nodeEnv = env.NODE_ENV?.trim();
  if (!nodeEnv) {
    results.push({
      name: "NODE_ENV",
      status: "EMPTY",
      notes: "Optional: Defaults to 'development'",
    });
  } else if (!["development", "test", "production"].includes(nodeEnv)) {
    results.push({
      name: "NODE_ENV",
      status: "INVALID",
      notes: "Must be 'development', 'test', or 'production'",
    });
  } else {
    results.push({
      name: "NODE_ENV",
      status: "OK",
      notes: `Configured ('${nodeEnv}')`,
    });
  }

  return results;
}

export function printEnvStatusTable(items: EnvCheckItem[]) {
  console.log("\n📋 PropLead AI — Environment Configuration Check (.env.local)");
  console.log("══════════════════════════════════════════════════════════════════════════════════");
  console.log(
    `${"Variable Name".padEnd(25)} │ ${"Status".padEnd(9)} │ Notes`
  );
  console.log("──────────────────────────┼───────────┼───────────────────────────────────────────");

  let emptyCount = 0;
  let invalidCount = 0;

  for (const item of items) {
    let statusIcon = "✅ OK     ";
    if (item.status === "EMPTY") {
      statusIcon = "⚪ EMPTY  ";
      emptyCount++;
    } else if (item.status === "INVALID") {
      statusIcon = "❌ INVALID";
      invalidCount++;
    }

    console.log(
      `${item.name.padEnd(25)} │ ${statusIcon} │ ${item.notes}`
    );
  }

  console.log("══════════════════════════════════════════════════════════════════════════════════");
  if (invalidCount > 0) {
    console.log(`⚠️  ${invalidCount} variable(s) marked INVALID. Please correct them in .env.local.`);
  } else if (emptyCount > 0) {
    console.log(`ℹ️  ${emptyCount} variable(s) empty. Fill required secrets (DATABASE_URL, LLM_API_KEY) in .env.local.`);
  } else {
    console.log("🎉 All environment variables are configured and valid!");
  }
  console.log("");
}

// Direct CLI execution
if (require.main === module || process.argv[1]?.includes("check-env.ts")) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const parsed = parseEnvFile(envPath);
  const items = checkEnvStatuses(parsed);
  printEnvStatusTable(items);
}
