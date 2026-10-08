import pg from "pg";

import { setQuery } from "../db/db.js";
import { migrate, setClientFactory } from "../db/migrate.js";

// A pool against a real Postgres (TEST_DATABASE_URL), wired into db.ts's `query`
// seam. Unlike pglite's single connection, pooled connections interleave, which
// the race tests need. The schema is dropped first, so point it at a throwaway
// database. Close the returned pool in afterAll.
export async function createPgTestDb(url: string): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  setClientFactory(async () => {
    const client = await pool.connect();
    return {
      client: {
        query: async (sql, params) => ({
          rows: (await client.query(sql, params)).rows,
        }),
        exec: async (sql) => {
          await client.query(sql);
        },
      },
      close: async () => client.release(),
    };
  });
  await migrate();
  setQuery(async (sql, params) => (await pool.query(sql, params)).rows);
  return pool;
}
