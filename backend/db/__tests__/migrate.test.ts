// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  migrate,
  setClientFactory,
  status,
  type MigrationClient,
} from "../migrate";

// A fresh, empty pglite database per test, wired into migrate.ts's own client
// seam (not db.ts's — migrate.ts needs interactive transactions, which HTTP
// query() can't do). Single connection: fine for these tests, since none of
// them run concurrent migrate() calls (that's task 21, against real Postgres).
let pg: PGlite;

beforeEach(async () => {
  pg = new PGlite();
  const client: MigrationClient = {
    query: (sql, params) => pg.query(sql, params),
    exec: async (sql) => {
      await pg.exec(sql);
    },
  };
  setClientFactory(async () => ({ client, close: async () => {} }));
});

afterEach(async () => {
  await pg.close();
});

async function writeMigrationsDir(files: Record<string, string>): Promise<URL> {
  const dir = await mkdtemp(join(tmpdir(), "librune-migrations-"));
  await Promise.all(
    Object.entries(files).map(([filename, sql]) =>
      writeFile(join(dir, filename), sql),
    ),
  );
  return new URL(`${dir}/`, "file://");
}

const MIGRATION_A = { "001_a.sql": "CREATE TABLE a (id int PRIMARY KEY);" };

describe("migrate", () => {
  it("applies pending migrations in order and records them", async () => {
    const dir = await writeMigrationsDir({
      "001_a.sql": "CREATE TABLE a (id int PRIMARY KEY);",
      "002_b.sql": "CREATE TABLE b (id int PRIMARY KEY);",
    });
    try {
      const result = await migrate(dir);
      expect(result.applied).toEqual(["001_a.sql", "002_b.sql"]);

      const { rows } = await pg.query<{ filename: string }>(
        "SELECT filename FROM schema_migrations ORDER BY filename",
      );
      expect(rows.map((r) => r.filename)).toEqual(["001_a.sql", "002_b.sql"]);
    } finally {
      await rm(new URL(dir), { recursive: true });
    }
  });

  it("a second run is a no-op", async () => {
    const dir = await writeMigrationsDir(MIGRATION_A);
    try {
      await migrate(dir);
      const second = await migrate(dir);
      expect(second.applied).toEqual([]);
    } finally {
      await rm(new URL(dir), { recursive: true });
    }
  });

  it("rejects an already-applied file whose content changed", async () => {
    const dir = await writeMigrationsDir(MIGRATION_A);
    try {
      await migrate(dir);
      await writeFile(
        new URL("001_a.sql", dir),
        "CREATE TABLE a (id int PRIMARY KEY, extra text);",
      );
      await expect(migrate(dir)).rejects.toThrow("different hash");
    } finally {
      await rm(new URL(dir), { recursive: true });
    }
  });

  it("a query against a column no migration created fails", async () => {
    const dir = await writeMigrationsDir(MIGRATION_A);
    try {
      await migrate(dir);
      await expect(pg.query("SELECT missing_column FROM a")).rejects.toThrow();
    } finally {
      await rm(new URL(dir), { recursive: true });
    }
  });
});

describe("status", () => {
  it("lists applied and pending files", async () => {
    const dir = await writeMigrationsDir({
      "001_a.sql": "CREATE TABLE a (id int PRIMARY KEY);",
      "002_b.sql": "CREATE TABLE b (id int PRIMARY KEY);",
    });
    try {
      expect(await status(dir)).toEqual({
        applied: [],
        pending: ["001_a.sql", "002_b.sql"],
      });

      await migrate(dir);

      expect(await status(dir)).toEqual({
        applied: ["001_a.sql", "002_b.sql"],
        pending: [],
      });
    } finally {
      await rm(new URL(dir), { recursive: true });
    }
  });
});
