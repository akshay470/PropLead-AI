import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

/**
 * Loads .env.local first, then .env into process.env.
 * Executes automatically upon import for CLI scripts and migration tools.
 */
export function loadEnv(customCwd?: string): void {
  const root = customCwd || process.cwd();
  const envLocalPath = path.resolve(root, ".env.local");
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  }
  const envPath = path.resolve(root, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

// Side-effect execution on first import
loadEnv();
