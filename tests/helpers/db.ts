import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

/**
 * Applies all real SQL migration files from /drizzle in alphabetical order
 * to a fresh PGlite instance.
 */
export async function applyMigrations(pg: PGlite): Promise<void> {
  const drizzleDir = path.resolve(__dirname, "../../drizzle");
  const files = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = path.join(drizzleDir, file);
    const sqlContent = fs.readFileSync(filePath, "utf-8");
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await pg.exec(stmt);
    }
  }
}
