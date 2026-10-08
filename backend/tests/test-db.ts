import { PGlite } from "@electric-sql/pglite";

import { setQuery } from "../db/db.js";
import { migrate, setClientFactory } from "../db/migrate.js";

// A fresh in-process Postgres with every migration applied through the real
// migration runner, wired into db.ts's `query` seam. Call once per test file
// (beforeAll) and close it in afterAll; test files that use it need
// `// @vitest-environment node`.
export async function createTestDb(): Promise<PGlite> {
  const pg = new PGlite();
  setClientFactory(async () => ({
    client: {
      query: (sql, params) => pg.query(sql, params),
      exec: async (sql) => {
        await pg.exec(sql);
      },
    },
    close: async () => {},
  }));
  await migrate();
  setQuery(
    async (sql, params) =>
      (await pg.query<Record<string, unknown>>(sql, params)).rows,
  );
  return pg;
}
