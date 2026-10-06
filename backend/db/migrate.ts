import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

import { Pool } from "@neondatabase/serverless";

// Interactive transactions (BEGIN/advisory lock/COMMIT) need the WebSocket Pool,
// not db.ts's HTTP query() — see docs/infra-migration/database-neon.md. This is
// the only other file that imports the driver, and only for migrations.
// Connects over the direct (unpooled) connection string: DATABASE_URL is the
// pooled endpoint runtime code uses; migrations need DATABASE_URL_UNPOOLED.

// A single connection that can run BEGIN/COMMIT/ROLLBACK and parameterized
// queries — what both the real Pool client and the pglite test fixture provide.
// `exec` runs a migration file's SQL as-is (often several statements) via the
// simple query protocol; `query` always goes through the parameterized one,
// which several drivers (pglite included) reject multi-statement SQL on.
export interface MigrationClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}

type ClientFactory = () => Promise<{
  client: MigrationClient;
  close: () => Promise<void>;
}>;

let clientFactory: ClientFactory | undefined;

// Tests inject a pglite-backed client (a single connection, sufficient for the
// idempotency/hash/status tests here); task 21's concurrency tests run against
// real Postgres instead, since a single connection can't interleave.
export function setClientFactory(factory: ClientFactory): void {
  clientFactory = factory;
}

function getClientFactory(): ClientFactory {
  if (!clientFactory) {
    clientFactory = async () => {
      const pool = new Pool({ connectionString: connectionString() });
      const poolClient = await pool.connect();
      // node-postgres/Neon's Pool client uses the simple query protocol for a
      // no-params .query(sql) call, which allows multiple statements.
      const client: MigrationClient = {
        query: async <T = Record<string, unknown>>(
          sql: string,
          params?: unknown[],
        ) => {
          const result = await poolClient.query(sql, params);
          return { rows: result.rows as T[] };
        },
        exec: async (sql) => {
          await poolClient.query(sql);
        },
      };
      return {
        client,
        close: async () => {
          poolClient.release();
          await pool.end();
        },
      };
    };
  }
  return clientFactory;
}

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

// Arbitrary fixed lock key for this app's migrations; any two processes running
// migrate() against the same database serialize on it.
const ADVISORY_LOCK_KEY = 7830196;

interface MigrationFile {
  filename: string;
  sql: string;
  sha256: string;
}

interface AppliedMigration {
  filename: string;
  sha256: string;
  applied_at: Date;
}

async function readMigrationFiles(dir: URL): Promise<MigrationFile[]> {
  const filenames = (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(new URL(filename, dir), "utf8");
      return {
        filename,
        sql,
        sha256: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

function connectionString(): string {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");
  return url;
}

export async function status(
  dir: URL = MIGRATIONS_DIR,
): Promise<{ applied: string[]; pending: string[] }> {
  const files = await readMigrationFiles(dir);
  const { client, close } = await getClientFactory()();
  try {
    const { rows } = await client.query<AppliedMigration>(
      "SELECT filename, sha256, applied_at FROM schema_migrations",
    );
    const appliedByFilename = new Map(rows.map((r) => [r.filename, r]));
    return {
      applied: rows.map((r) => r.filename).sort(),
      pending: files
        .filter((f) => !appliedByFilename.has(f.filename))
        .map((f) => f.filename),
    };
  } catch (err) {
    // schema_migrations doesn't exist yet: nothing has ever been applied.
    if (err instanceof Error && "code" in err && err.code === "42P01") {
      return { applied: [], pending: files.map((f) => f.filename) };
    }
    throw err;
  } finally {
    await close();
  }
}

export async function migrate(
  dir: URL = MIGRATIONS_DIR,
): Promise<{ applied: string[] }> {
  const files = await readMigrationFiles(dir);
  const { client, close } = await getClientFactory()();
  const applied: string[] = [];
  try {
    await client.query("BEGIN");
    // pg_advisory_xact_lock is transaction-scoped and released automatically at
    // COMMIT/ROLLBACK, so overlapping runs serialize here and cannot double-apply.
    await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   text        PRIMARY KEY,
         sha256     text        NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const { rows: appliedRows } = await client.query<AppliedMigration>(
      "SELECT filename, sha256 FROM schema_migrations",
    );
    const appliedByFilename = new Map(
      appliedRows.map((r) => [r.filename, r.sha256]),
    );

    for (const file of files) {
      const appliedHash = appliedByFilename.get(file.filename);
      if (appliedHash !== undefined) {
        if (appliedHash !== file.sha256) {
          throw new Error(
            `${file.filename} was already applied with a different hash — edited migrations are rejected`,
          );
        }
        continue;
      }
      await client.exec(file.sql);
      await client.query(
        "INSERT INTO schema_migrations (filename, sha256) VALUES ($1, $2)",
        [file.filename, file.sha256],
      );
      applied.push(file.filename);
    }

    await client.query("COMMIT");
    return { applied };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await close();
  }
}

// CLI entry: `pnpm db:migrate` / `pnpm db:status`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  if (mode === "status") {
    const { applied, pending } = await status();
    console.log(`applied (${applied.length}):`);
    applied.forEach((f) => console.log(`  ${f}`));
    console.log(`pending (${pending.length}):`);
    pending.forEach((f) => console.log(`  ${f}`));
  } else if (mode === "migrate") {
    const { applied } = await migrate();
    console.log(
      applied.length === 0
        ? "no pending migrations"
        : `applied: ${applied.join(", ")}`,
    );
  } else {
    console.error("usage: migrate.ts <migrate|status>");
    process.exit(1);
  }
}
