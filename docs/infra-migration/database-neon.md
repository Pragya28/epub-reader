# Database: Neon Postgres via Vercel Marketplace

## What and why

**What.** The sync backend's relational database is a Postgres database hosted on Neon, provisioned through the Vercel Marketplace integration. It holds three small tables — `users`, `sync_state` (hash of the registration proof, last successful sync) and `devices` (one row per device, holding that device's token hash, previous token hash, rotation and last-seen timestamps) — anchored on a single user. It never holds library content: the encrypted archive lives in blob storage, and the encryption key never reaches the server.

**Why this one.**

- A free tier is a hard requirement for this personal-use app. Neon's free plan comfortably covers the workload (one user, a few devices, a handful of rows, manual sync).
- It is built for serverless: short-lived functions do not exhaust connections.
- The Vercel Marketplace integration provisions the database and injects the connection env vars into the project — one dashboard, minimal setup.
- A cold start after idle (scale-to-zero, a few hundred ms) is invisible next to a manual, user-triggered library upload.

**Alternatives rejected.**

- **Supabase** — the free tier pauses a project after about a week of inactivity. Sync is manual and personal, so a week without syncing is realistic, and a paused database would look identical to an expired credential.
- Other hosted Postgres options were not evaluated in depth; free-tier terms change, so re-check before relying on any of them.

## Coupling points

Everything the codebase and deployment know about this choice:

| Coupling                 | Where                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection string        | `DATABASE_URL` env var, read in one place                                                                     | Injected by the Marketplace integration (alongside other `POSTGRES_*` vars). Billing is tied to the Vercel account.                                                                                                                                                                                                          |
| Database driver          | `backend/db/db.ts` only                                                                                       | The one file that imports the driver, `@neondatabase/serverless` (HTTP mode, no ORM). HTTP mode works from any host, so moving the functions off Vercel needs no driver change; leaving Neon itself means swapping the driver here. A `query(sql, params)` seam keeps the rest of the backend and the tests driver-agnostic. |
| Interactive transactions | Not used                                                                                                      | HTTP mode only batches non-interactive transactions. Queries are single atomic statements instead; a future need for interactive transactions uses the same package's WebSocket `Pool`.                                                                                                                                      |
| Pooled vs direct URL     | Connection config                                                                                             | Neon offers a pooled endpoint (transaction-mode pooler) and a direct one. Runtime code uses the pooled one; the migration runner uses the direct one.                                                                                                                                                                        |
| Schema                   | `backend/db/migrations/*.sql`                                                                                 | Plain SQL, forward-only, applied by a small runner (`backend/db/migrate.ts`). The `schema_migrations` table records each applied file with its SHA-256 and travels with a database dump.                                                                                                                                     |
| Migration trigger        | Vercel `buildCommand` in `vercel.json`                                                                        | Runs `pnpm db:migrate` on production deploys only (`VERCEL_ENV=production`). Leaving Vercel means re-creating this step in the new deploy pipeline; leaving Neon means pointing `DATABASE_URL` at the new database first so the first deploy applies nothing unexpected.                                                     |
| Atomicity guarantees     | Single-statement queries (`INSERT … ON CONFLICT`, conditional `UPDATE … RETURNING`, CTEs) plus DB constraints | The one-time `setup` guard and rotation/recovery races are enforced by the database, not by application code.                                                                                                                                                                                                                |
| Scale-to-zero cold start | Client behavior on first request after idle                                                                   | Tolerated today; a destination that is always-on removes it, one that is slower to wake makes it worse.                                                                                                                                                                                                                      |
| Tests                    | In-process Postgres (`pglite`); real Postgres service container in CI for race tests                          | Tests do not talk to the hosted database. The race tests use a `pg`-backed implementation of the `query` seam against `TEST_DATABASE_URL`, so they run on any Postgres-compatible target.                                                                                                                                    |

## Rules that keep it portable

- Migrations use standard Postgres only — no Neon-specific features or extensions, no reliance on database branching.
- Only `db.ts` imports the driver; everything else calls its functions.
- Code works under **transaction-mode pooling**: no session-level state (session `SET`, session advisory locks, long-lived prepared statements, `LISTEN/NOTIFY`). This is also what most providers' poolers require.
- Race-safety comes from constraints and single atomic statements, so it is a property of the schema and queries, not of one provider's transaction behavior.
- Timestamps are `timestamptz` (UTC); ids are generated by the application or a standard Postgres default.

## Migration procedure (destination-agnostic)

1. **Inventory.** Re-read the coupling table above; check for anything added since (new env vars, CI config, scripts that read the connection string).
2. **Provision the destination** and record its connection string(s). Note whether it has a pooler and in which mode.
3. **Apply the schema** by running `backend/db/migrations/*.sql` against it. If the destination is Postgres-compatible this should work unchanged; if it is not, translate the three tables (types for uuid/timestamp/text) and re-verify every constraint the guarantees above depend on.
4. **Adapt the data-access layer.** If the driver is not provider-neutral, swap it in `db.ts`. If the destination is not Postgres, rewrite the single-statement queries to their equivalents there and confirm each still yields the same atomic behavior.
5. **Run the tests** against the destination (the `pglite` fixture cannot vouch for a non-Postgres system) — especially the one-time `setup` guard race test and the rotation/recovery tests.
6. **Carry the data across.** The three tables hold a handful of rows. For a Postgres destination: dump from the old database (`pg_dump`) and restore into the new one. Because token hashes and device rows come with it, existing devices keep working without noticing the move.
   - _If the data is not carried over_, the system is effectively fresh: `setup` runs again, issues a new credential, and every device must re-pair. The encryption key was never on the server, so archives already in blob storage stay decryptable.
7. **Cut over.** Sync is manual and low-traffic, so no elaborate freeze is needed: set the new `DATABASE_URL` in the deployment (copy the current value out of the integration first if you are unlinking it — unlinking may remove the injected vars), redeploy, and smoke-test `setup`/`recover` on a throwaway device.
8. **Keep the old database** until the new one is confirmed healthy, then retire it. Rolling back is restoring the old `DATABASE_URL`.

## What does not change

- The client app, the encryption scheme and the `contracts/` request/response shapes.
- The auth rules (72h rotation, 7-day idle expiry, one-time `setup`, recovery only for known devices).
- The archive in blob storage.
