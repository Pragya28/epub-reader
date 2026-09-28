import { readdir, readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

import { setQuery } from "../db/db";

const MIGRATIONS_DIR = new URL("../db/migrations/", import.meta.url);

// A fresh in-process Postgres with every migration applied, wired into db.ts's
// `query` seam. Call once per test file (beforeAll) and close it in afterAll;
// test files that use it need `// @vitest-environment node`.
// ponytail: applies the .sql files directly; switch to migrate.ts once task 8 lands so tests exercise the runner.
export async function createTestDb(): Promise<PGlite> {
  const pg = new PGlite();
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await pg.exec(await readFile(new URL(file, MIGRATIONS_DIR), "utf8"));
  }
  setQuery(
    async (sql, params) =>
      (await pg.query<Record<string, unknown>>(sql, params)).rows,
  );
  return pg;
}
