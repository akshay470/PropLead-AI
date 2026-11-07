import { describe, it, expect, afterEach } from "vitest";
import { assertCanSeed, extractDatabaseHost } from "@/server/db/seed-guards";
import { runSeed } from "@/server/db/seed";

describe("Lazy DB Client Initialization & Safety Guards", () => {
  const originalDbUrl = process.env.DATABASE_URL;
  const originalAllowSeed = process.env.ALLOW_SEED;
  const originalAllowLocalSeed = process.env.ALLOW_LOCAL_SEED;

  afterEach(() => {
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (originalAllowSeed !== undefined) {
      process.env.ALLOW_SEED = originalAllowSeed;
    } else {
      delete process.env.ALLOW_SEED;
    }
    if (originalAllowLocalSeed !== undefined) {
      process.env.ALLOW_LOCAL_SEED = originalAllowLocalSeed;
    } else {
      delete process.env.ALLOW_LOCAL_SEED;
    }
  });

  describe("DB Client Import & Lazy Initialization", () => {
    it("does not create a DB client or throw at module import time when DATABASE_URL is unset", async () => {
      delete process.env.DATABASE_URL;

      // Importing @/server/db must complete without instantiating a client or connecting to any port
      const dbModule = await import("@/server/db");
      expect(dbModule).toBeDefined();
      expect(typeof dbModule.getDb).toBe("function");
      expect(dbModule.db).toBeDefined();

      // Calling getDb() with DATABASE_URL unset must throw a clear error naming DATABASE_URL
      expect(() => dbModule.getDb()).toThrow(/DATABASE_URL/);

      // Accessing a query property on the lazy proxy db while DATABASE_URL is unset must also throw naming DATABASE_URL
      expect(() => dbModule.db.select()).toThrow(/DATABASE_URL/);
    });

    it("throws a clear error naming DATABASE_URL without printing secret values or falling back to localhost", async () => {
      process.env.DATABASE_URL = "";
      const { getDb } = await import("@/server/db");

      try {
        getDb();
        expect.unreachable("getDb should have thrown");
      } catch (err: any) {
        expect(err.message).toContain("DATABASE_URL");
        expect(err.message).not.toContain("localhost:5432");
      }
    });
  });

  describe("Host Extraction & Seed Guards", () => {
    it("extracts database host correctly without leaking credentials, port, or path", () => {
      expect(
        extractDatabaseHost(
          "postgres://supersecretuser:supersecretpass@ep-cool-fog-1234.us-east-2.aws.neon.tech/neondb?sslmode=require"
        )
      ).toBe("ep-cool-fog-1234.us-east-2.aws.neon.tech");

      expect(
        extractDatabaseHost("postgresql://admin:mypassword@localhost:5432/proplead_ai")
      ).toBe("localhost");

      expect(
        extractDatabaseHost("postgres://user:pass@127.0.0.1:5432/proplead_ai")
      ).toBe("127.0.0.1");

      expect(
        extractDatabaseHost("postgres://user:pass@[::1]:5432/proplead_ai")
      ).toBe("::1");
    });

    it("refuses to seed when ALLOW_SEED is not 'true'", () => {
      expect(() =>
        assertCanSeed({
          databaseUrl: "postgres://user:pass@ep-cool.neon.tech/neondb",
          allowSeed: "false",
        })
      ).toThrow(/ALLOW_SEED/);

      expect(() =>
        assertCanSeed({
          databaseUrl: "postgres://user:pass@ep-cool.neon.tech/neondb",
          allowSeed: undefined,
        })
      ).toThrow(/ALLOW_SEED/);
    });

    it("refuses to seed localhost/127.0.0.1 when ALLOW_LOCAL_SEED is not 'true'", () => {
      // localhost
      expect(() =>
        assertCanSeed({
          databaseUrl: "postgres://user:secretpass@localhost:5432/proplead",
          allowSeed: "true",
        })
      ).toThrow(/Refusing to seed local database \(localhost\)/);

      // 127.0.0.1
      expect(() =>
        assertCanSeed({
          databaseUrl: "postgres://user:secretpass@127.0.0.1:5432/proplead",
          allowSeed: "true",
        })
      ).toThrow(/Refusing to seed local database \(127.0.0.1\)/);

      // ::1
      expect(() =>
        assertCanSeed({
          databaseUrl: "postgres://user:secretpass@[::1]:5432/proplead",
          allowSeed: "true",
        })
      ).toThrow(/Refusing to seed local database \(::1\)/);

      // Verify that secretpass is NEVER present in the thrown error message
      try {
        assertCanSeed({
          databaseUrl: "postgres://user:secretpass@localhost:5432/proplead",
          allowSeed: "true",
        });
      } catch (err: any) {
        expect(err.message).not.toContain("secretpass");
      }
    });

    it("allows seeding localhost when ALLOW_LOCAL_SEED is explicitly 'true'", () => {
      const result = assertCanSeed({
        databaseUrl: "postgres://user:secretpass@localhost:5432/proplead",
        allowSeed: "true",
        allowLocalSeed: "true",
      });
      expect(result.host).toBe("localhost");
    });

    it("allows seeding remote host when ALLOW_SEED is 'true'", () => {
      const result = assertCanSeed({
        databaseUrl: "postgres://user:secretpass@ep-cool-proj.neon.tech/neondb?sslmode=require",
        allowSeed: "true",
      });
      expect(result.host).toBe("ep-cool-proj.neon.tech");
    });

    it("refuses to seed when DATABASE_URL is missing", () => {
      expect(() =>
        assertCanSeed({
          databaseUrl: undefined,
          allowSeed: "true",
        })
      ).toThrow(/DATABASE_URL is missing/);
    });

    it("verifies runSeed refuses localhost host and halts before cleanup", async () => {
      process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/proplead_ai";
      process.env.ALLOW_SEED = "true";
      delete process.env.ALLOW_LOCAL_SEED;

      await expect(runSeed()).rejects.toThrow(/Refusing to seed local database/);
    });
  });
});
