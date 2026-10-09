# Feature Phase 1 · Sprint 2 — Task List (Gap Analysis vs Codebase)

Generated 2026-10-09 by comparing `central-docs/09 - Feature Phase 1 - Sync & Cross-Device/06 - Implementation/Sprint - 2 Encryption & Archive Transport.md` (plus `02 - Architecture.md` and `03 - Auth & Security.md`) against the current codebase.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Baseline (what already exists going in)

- **Identity surface is complete (Sprint 1).** `setup`, `invites`, `register`, `recover` handlers, the shared auth module (per-device tokens, 72h rotation, 7d idle expiry, previous-token grace), `contracts/` (zod schemas, D10 error codes, `X-Device-Id` header, the optional rotated `token` fragment in `contracts/authenticated.ts`), `handlers/http.ts` helpers, the `pglite` + real-Postgres test harnesses.
- **`sync_state` already has `last_synced_at`** (one row per user, set up by `001_init.sql`) — `push` updates it; no schema change is expected unless the blob-key scheme needs one.
- **Archive format exists client-side.** `src/services/backup/backup-archive.ts` (`createArchive`/`readArchive`) produces the ZIP the sync archive reuses; nothing encrypts it yet.
- **No blob storage, no signed URLs, no Web Crypto code, no `pull`/`push` handlers.** `@neondatabase/serverless` and `pg` are the only server dependencies.

## Decisions

Phase decisions D1–D11 live in [docs/decisions/feature-phase-1.md](../../decisions/feature-phase-1.md).

- **D12 — Cloudflare R2** for blob storage (S3-compatible presigned URLs, zero egress, portable). Signing via `aws4fetch`; private bucket, CORS for the app origin, env vars for account id, bucket, and access key pair. Recorded in `feature-phase-1.md`.
- **Encryption module location.** The spec says shared with manual export/import, so it lives client-side at `src/services/backup/backup-encryption.ts`, framework-agnostic (Web Crypto only, no Dexie/Zustand), like `backup-archive.ts`. Server never imports it.

Each new package needs explicit approval (project rule: never install without asking).

---

## Day 1 — Encryption Module

1. ✅ **`backup-encryption.ts`** — `encryptArchive(bytes, key)` / `decryptArchive(bytes, key)` using AES-GCM via Web Crypto; random 96-bit IV prepended to the ciphertext; a format version byte so the envelope can evolve. Standalone: no import of sync, auth, or storage code.
2. ✅ **Distinct wrong-key failure** — `WrongKeyError` (a `DecryptionError` subclass) for an authentication-tag failure, separate from the plain `DecryptionError` for "input too short / unknown version" so callers can tell "wrong key" from "corrupt file".
3. ✅ **Key generation + encoding helper** — generate a 256-bit key and encode/decode it for display/entry (Settings UI is Sprint 4; only the pure functions land here). Delivered as `encryption-key-code.ts`: base32 in groups of four, 52 key characters plus a 4-character checksum (first 20 bits of SHA-256 of the key); decoding ignores case, spaces and dashes and rejects a typo with `KeyCodeError`.
4. ✅ **Tests** — round-trip is byte-identical (empty, small, multi-MB input); wrong key throws the distinct error; tampered ciphertext throws; truncated input throws a different error; two encryptions of the same input differ (IV freshness).

### Done Criteria

✅ The archive can be encrypted and decrypted correctly on its own, before anything else depends on it.

---

## Day 2 — Pull & Push Endpoints

5. 🟡 **Blob provider (D12 = R2) — decided and recorded**, `docs/infra-migration/blob-storage.md` written. Remaining: approval to install `aws4fetch`, and creating the bucket/token/CORS (manual, in the Cloudflare dashboard).
6. ❌ **Contracts** — `contracts/pull.ts`, `contracts/push.ts` (zod request/response; both extend the authenticated-response fragment so a rotated `token` rides along). `pull` response: `{ downloadUrl, lastSyncedAt }` or the "nothing yet" shape. `push` is two-step (request upload URL, then confirm) so `last_synced_at` can move only after the upload is confirmed.
7. ❌ **Blob access module (`backend/blob/`)** — the one place that talks to the provider: sign upload URL, sign download URL, confirm an object exists. Object key derived from `userId` only, never from client input. Injected through a seam like `query`, so tests use an in-memory fake.
8. ❌ **`pull` handler + `api/pull.ts` re-export** — authenticates via the shared auth module; returns "nothing yet" when `last_synced_at` is null; otherwise a short-lived signed download URL for that user's archive.
9. ❌ **`push` handler + `api/push.ts` re-export** — authenticated; step 1 issues a signed upload URL; step 2 verifies the object exists then sets `last_synced_at`. Never touched on step 1.
10. ❌ **Tests** — `pull` returns "nothing yet" before any push; `push` leaves `last_synced_at` unchanged until confirmed, and a confirm with no uploaded object is rejected; expired/invalid token rejected on both via the shared auth check; user A can never obtain a URL for user B's key; every error path returns its D10 code and status; responses carry `Cache-Control: no-store`; contract tests parse each handler's actual body with its response schema.

### Done Criteria

❌ An authenticated device can push and pull an encrypted archive through signed URLs.

---

## Day 3 — Integration

11. ❌ **Registration-proof derivation** — `proof = HKDF(encryptionKey, "librune-register")` (D7), one-way with a fixed label, in `src/services/` beside the encryption module; deterministic across devices and never equal to the key. The server side (`setup`/`register` hashing the opaque proof) already exists.
12. ❌ **End-to-end test** — `setup` → `push` → `pull` as one flow, then a second device `register`s with the same key-derived proof and pulls the same archive. Archive bytes encrypted client-side with the Day 1 module; the in-memory blob fake stands in for the provider.
13. 🟡 **Token rotation on `pull`/`push`** — rotation, previous-token retry, and "other devices unaffected" are already covered for `invites` and in `auth` tests (Sprint 1 items 10-11, 20); add the same assertions through `pull`/`push` responses.
14. ✅ **Tests** — freshly set-up device pushes then pulls its own archive back (decrypts to the original); a token due for rotation returns the new token, the old one is accepted only as a retry until the new one is first used; two devices push/pull independently and one's rotation never invalidates the other's token; proof stable across devices, never equal to the key.

### Done Criteria

❌ The entire backend surface — identity plus archive transport — works together as one system, ready for the client to build against in Sprint 3.

---

# Audit reconciliation

Skipped for Sprint 2 — no UI surfaces (key display/entry and sync controls are Sprint 4). The phase's first `/impeccable audit` runs with the first sprint that touches UI.

# Infra & stack migration notes

Blob storage is a new infrastructure decision this sprint: [blob-storage.md](../../infra-migration/blob-storage.md) is written; keep it current as `backend/blob/` lands. Update `database-neon.md` only if `pull`/`push` add coupling points to the DB driver.

# Open questions

- Max archive size / per-user cap — per D11 a non-goal unless the storage free tier is pressured.

# Deferred / Out of Scope

- **Client sync engine, merge-on-pull, conflict handling** — Sprint 3.
- **Settings UI, key display/entry, sync status** — Sprint 4.
- **Rate limiting and per-user storage quotas** — non-goals per D11 and `05 - Open Questions & Non-Goals.md`.
