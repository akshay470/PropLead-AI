import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

// 1. Load env from .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// 2. Read DATABASE_URL from process.env
const databaseUrl = process.env.DATABASE_URL;
const isTest = process.env.NODE_ENV === "test";

// If DATABASE_URL is missing or points to localhost/127.0.0.1 while NODE_ENV is not "test",
// print a clear error naming the variable (never print its value) and exit with a non-zero code.
if (!isTest) {
  if (!databaseUrl || databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
    console.error(
      "❌ Error: DATABASE_URL is missing or points to localhost/127.0.0.1.\n" +
      "Hint: Set DATABASE_URL in .env.local (see .env.example)"
    );
    process.exit(1);
  }
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
