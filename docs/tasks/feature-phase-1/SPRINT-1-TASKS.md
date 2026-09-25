# Feature Phase 1 · Sprint 1 — Task List (Gap Analysis vs Codebase)

Generated 2026-09-24 by comparing `central-docs/09 - Feature Phase 1 - Sync & Cross-Device/06 - Implementation/Sprint - 1 Backend Foundation.md` (plus `02 - Architecture.md` and `03 - Auth & Security.md`) against the current codebase.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Baseline (what already exists going in)

Sprint 1 is the first backend work in this repo — everything before it is a client-only PWA.

- **No backend code exists.** No `api/` directory, no serverless functions, no Postgres client, no migration tooling, no server-side test setup. Every item below is greenfield.
- **Deploy target already exists.** `vercel.json` (SPA rewrite + SW/manifest cache headers) and `@vercel/speed-insights` — Vercel Functions under `api/` deploy alongside the frontend, matching the architecture doc's "one deploy target."
- **Vitest + jsdom is the only test runner.** Server modules need the `node` environment (per-file `// @vitest-environment node`), not jsdom.
- **Existing `src/services/*` is framework-agnostic client infra.** Server code must not live there — it isn't bundled into the PWA and must not import from `src/`.

## Decisions

Phase decisions (D1–D10), scope confirmations, the folder layout and import rules live in [docs/decisions/feature-phase-1.md](../../decisions/feature-phase-1.md). Tasks below reference decisions by number.

Each new package needs explicit approval (project rule: never install without asking).

---

## Day 1 — Schema & Data Access ❌

1. ❌ **`users` / `sync_state` / `devices` tables + migration** — `users` (id uuid, created_at); `sync_state` (user_id, registration_proof_hash, last_synced_at; a single-row guarantee enforces one user); `devices` (device_id, user_id, label, token_hash, prev_token_hash, token_rotated_at, first_seen_at, last_seen_at — `last_seen_at` is the idle clock). Shape per `02 - Architecture.md` data model.
2. ❌ **Postgres client (`db.ts`)** — thin raw-row access for all three tables (insert/get per table, plus the queries Days 2-3 need). No ORM, no abstraction layer.
3. ❌ **Server test harness** — node-environment Vitest config/pragma + a `pglite` fixture that applies the migrations fresh per test file, injected through `db.ts`'s `query(sql, params)` seam.
4. ❌ **Tests** — migration applies cleanly; `db.ts` round-trip (insert + read one row per table).
5. ❌ **Scaffold `backend/`, `contracts/`, `api/`** — folders per the Layout in [feature-phase-1.md](../../decisions/feature-phase-1.md#layout); `backend/tsconfig.json` (Node types, includes `backend/` + `contracts/`); `tsconfig.app.json` gains `contracts/` in `include` plus an `@contracts/*` alias mirrored in `vite.config.ts` and the Vitest config. Config edits need approval.
6. ❌ **Boundary layer 1 — TypeScript project separation** — `src/` project has DOM types and no Node; `backend/` project has Node types and no DOM; neither includes the other's folder. A forbidden import fails `tsc -b` (already run by `pnpm build` and the pre-push hook).
7. ❌ **Boundary layer 2 — ESLint `no-restricted-imports`** — flat-config `files` overrides in `eslint.config.js`: `src/**` blocks `**/backend/**`, `**/api/**`, `node:*`; `backend/**` blocks `**/src/**` and DOM-only packages (e.g. `dexie`); `contracts/**` allows only `zod` + relative imports; `api/**` allows only `../backend/handlers/*`. Runs in the `lint-staged` pre-commit hook. Config edit needs approval.

8. ❌ **Migration runner** — `backend/db/migrate.ts`: applies pending numbered `.sql` files in order, forward-only. Records each in `schema_migrations` (filename, SHA-256, applied_at) atomically with the file; fails if an already-applied file's hash changed; takes an advisory lock so overlapping runs cannot double-apply. `pnpm db:migrate` applies; `pnpm db:status` lists applied and pending. Tests: a second run is a no-op; an edited applied file is rejected; status lists pending files; queries under test run on `pglite` with the migrations applied, so a query against a column no migration creates fails.
9. ❌ **Migrate on production deploy** — `vercel.json` `buildCommand` runs `pnpm db:migrate` only when `VERCEL_ENV=production`, then `pnpm build`. Preview deploys skip migration; `pnpm build` itself (the pre-push hook) never touches a database. Migrations stay additive-first (add, ship the code that uses it, remove later) because old code runs against the new schema during a deploy. Config edit needs approval.

### Done Criteria

❌ Schema exists and is queryable through `db.ts`; the folder layout and both import-boundary layers are in place and a deliberate violation (`src/` importing `backend/`) is rejected by `tsc -b` and by ESLint.

---

## Day 2 — Auth Core ❌

10. ❌ **One reusable auth module** — per-device token check (`deviceId` + token against that device's row, accepting the current hash or `prev_token_hash`; a successful check with the current hash clears `prev_token_hash`), activity bump (`last_seen_at`) on every successful check, 72h rotation check (returns a fresh token when due, moving the old hash to `prev_token_hash`), 7-day idle-expiry check per device. Tokens are `randomBytes(32)` base64url with no prefix; only the SHA-256 is stored and lookup is by `device_id`, then hash comparison. Clock injected (`now` param) so tests never sleep. Rules per `03 - Auth & Security.md`.
11. ❌ **Tests (mocked clock)** — rotation fires past 72h and not before; expiry fires past 7 days idle and not before; activity bump on every successful check; bad token rejected; a token belonging to another device rejected; previous token accepted as a retry and answered with the current token.

### Done Criteria

❌ Auth logic fully testable in isolation, ready to wire into endpoints.

---

## Day 3 — Setup, Register & Recovery Endpoints ❌

12. ❌ **Contracts** — `contracts/setup.ts`, `contracts/register.ts`, `contracts/recover.ts` (zod request/response schemas + inferred types), `contracts/errors.ts` (the D10 error-code union and `{ error: { code, message } }` shape), a shared authenticated-response fragment with the optional rotated `token` field (D9), the `X-Device-Id` header name, `contracts/auth-constants.ts` (72h, 7d), created on Day 2 with item 10, which consumes it.
13. ❌ **`setup` endpoint** — `backend/handlers/setup.ts` + `api/setup.ts` re-export. Validates the body via the contracts schema; takes `deviceId`, `label`, `proof`; succeeds only when no `sync_state` row exists; creates the user, stores `SHA-256(proof)`, creates the calling device with its first token (hash stored, plain returned once); returns `userId` + token.
14. ❌ **`register` endpoint** — `backend/handlers/register.ts` + `api/register.ts` re-export. Takes `userId`, `deviceId`, `label`, `proof`; succeeds only when the user exists and `SHA-256(proof)` matches; creates the device with its own token. Unknown user and wrong proof return the same `registration_rejected`. An already-registered `deviceId` is rejected. A device that cleared its site data generates a new `deviceId` and registers as a new device; its old row lapses through idle expiry.
15. ❌ **`recover` endpoint** — `backend/handlers/recover.ts` + `api/recover.ts` re-export. Takes `X-Device-Id` + that device's own expired token as `Authorization: Bearer`; succeeds only when the device is known, the token matches its row, **and** it is idle-expired; issues a fresh token.
16. ❌ **Tests** — every error path returns its D10 code and status; responses carry `Cache-Control: no-store`; `setup` rejects a second call; `register` rejects a wrong proof and an unknown user with the same error; `register` gives the new device its own token without invalidating existing devices' tokens; `recover` rejects an unknown device and a token that doesn't match the device; `recover` rejects when the token isn't expired; malformed body rejected by the schema; happy paths for all three; contract tests parse each handler's actual response body with its response schema.

### Done Criteria

❌ A device can bootstrap the first credential; a further device can register with `userId` + proof; a known device can recover after expiry — end to end against the real schema.

---

## Day 4 — Hardening ❌

17. ❌ **One-time `setup` guard under concurrency** — enforce in the database (single-row guarantee on `sync_state`), not check-then-insert in app code.
18. ❌ **`recover` mid-rotation window** — define and handle a token that is both past 72h and past 7d, a recover racing a normal rotation, a retry with the previous token after a lost rotation response, and the previous token rejected once the current token has been used.
19. ❌ **Race-condition regression tests** — N concurrent `setup` calls → exactly one succeeds; concurrent rotations of one device issue exactly one new token; recover/rotation overlap. Run against real Postgres through a `pg`-backed implementation of the `query` seam (single-connection `pglite` cannot interleave), gated on `TEST_DATABASE_URL` and skipped when unset. `.github/workflows/test.yml` gains a Postgres service container and sets the variable for the Vitest job. Workflow edit needs approval.
20. ❌ **Boundary layer 3 — built-output check** — assert that `dist/` (the PWA bundle) contains no `backend/` code or Node-only markers (`pg`/Neon driver, `node:crypto`), added to the existing production-build smoke test.

### Done Criteria

❌ Endpoints hold up under credential-system edge cases; the PWA bundle is verified free of backend code; Sprint 2 can build archive transport on top.

---

# Audit reconciliation

Skipped for Sprint 1 — it has no UI surfaces. The phase's first audit runs with the first sprint that touches UI.

# Infra & stack migration notes

Each infrastructure decision made in this sprint has a destination-agnostic migration note in [`docs/infra-migration/`](../../infra-migration/README.md) (starting with [database-neon.md](../../infra-migration/database-neon.md)). Update the matching file whenever a decision or its coupling points change.

# Deferred / Out of Scope

- **Archive transport, signed URLs, blob storage** — Sprint 2 (`Sprint - 2 Encryption & Archive Transport.md`).
- **Client encryption key generation** — Sprint 2; the server never sees it.
- **Client sync engine, Settings UI** — Sprints 3-4.
- **Rate limiting on `setup`/`register`/`recover`** — an explicit non-goal for this phase (`05 - Open Questions & Non-Goals.md`): an accepted risk for a personal, unpublished deployment with one legitimate user.
