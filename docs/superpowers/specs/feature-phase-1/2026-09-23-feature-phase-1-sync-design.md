# Feature Phase 1 — Sync & Cross-Device Design

> **Status:** where this spec and the phase decision log ([docs/decisions/feature-phase-1.md](../../../decisions/feature-phase-1.md), D1–D11) differ, the decision log is authoritative — notably the credential model, transport and error codes (D7–D10) and invite-based users (D11).

## Context

Development Phase (Sprints 1–8) is complete; Sprint 8 Day 7 release prep
shipped. `central-docs/00 - Index Epub Reader.md` introduces a new
**Feature Phases** tier for scoped initiatives beyond the original
product, and reserves **09 — Feature Phase 1: Sync & Cross-Device** as a
placeholder (`Status: Not started`). This spec is that phase's design.

Librune's positioning has always been local-first: all book data lives in
IndexedDB, nothing is uploaded (see this repo's `CLAUDE.md`). This phase
deliberately breaks that — **opt-in only**. A user who never authenticates
gets the exact product that exists today; the server exists only for a
user who chooses to turn sync on.

### What exists (reused, not redesigned)

- `services/backup/backup-archive.ts` — `createArchive`/`readArchive`, a
  versioned ZIP (`BACKUP_VERSION`) containing `manifest.json` (books,
  progress, `manualStatus`, groupings, a ten-key `PreferencesSnapshot`) +
  `books/<id>.epub` + `covers/<id>`.
- `features/library/actions/export-library.ts` /
  `features/library/actions/import-backup.ts` — `exportLibrary()` builds
  the archive from live storage; `readBackup()`/`applyBackup()` merge an
  archive back in, keyed by `StoredBook.fileHash`, with chapter-level
  `ProgressConflict` detection and a `"keep" | "take-backup"` resolution
  per conflicting book.
- `features/reader/utils/reading-progress-channel.ts` — cross-tab
  presence/progress broadcast over `BroadcastChannel`, with a
  client-generated `TAB_ID` (`createId()`, in-memory). **This is same-
  browser only** — `BroadcastChannel` has no cross-device transport, so
  this phase reuses its _UX shape_ (presence-aware, "updated elsewhere"
  messaging) but not the mechanism itself.
- `services/storage/book-lock.ts` is **not** a cross-tab/cross-device
  primitive — it is explicitly documented (`ponytail:` comment) as an
  in-memory, single-tab-only `Map`, serializing same-tab operations on one
  `bookId`. Not reusable here; noted because an earlier handoff draft
  assumed otherwise.
- Frontend is already deployed on **Vercel**.

### Non-goals (explicit, per product framing)

- No open signup or user management — built for one person first; further users only by invite code (D11).
- No usage analytics or telemetry.
- No automatic/background sync (decision 5).
- No incremental/per-book sync protocol (decision 3).
- Bookmarks/annotations (Roadmap Phase 1, still unbuilt) are **out of
  scope** — deferred to **Feature Phase 2**, which will extend this
  phase's manifest via a `BACKUP_VERSION` bump rather than redesigning
  the sync protocol.
- Storage-02 (TTL/eviction, currently deferred — PM-rejected because
  "auto-deleting someone's only copy is too risky") stays deferred until
  this phase has shipped and been trusted in practice; sequencing it
  alongside sync would remove the safety margin sync is meant to provide.

## Decisions

### 1. Backend: Vercel Functions + Vercel Blob + Vercel Postgres

Built as part of this project (not a self-hosted server the user runs
separately), deployed alongside the existing frontend — one repo, one
deploy pipeline, no second host to operate.

- **Vercel Functions** (`api/sync/*`) — thin API: auth check, issue
  signed Blob URLs, touch Postgres rows. No business logic beyond that.
- **Vercel Blob** — stores the archive itself (ciphertext — see decision
  6). Upload/download go through **signed URLs the client calls
  directly**, not through a function body, because a full-library archive
  (multiple EPUBs) can be tens of MB and would hit serverless
  body-size/timeout limits if proxied through a handler.
- **Vercel Postgres** (Neon-backed) — chosen over Vercel KV specifically
  for extensibility (relational schema, room to grow beyond a single row
  per user) even though a KV row would suffice for Phase 1 alone. Three
  tables:

```sql
users (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now()
);

sync_state (
  user_id            uuid primary key references users(id),
  token_hash         text not null,
  rotated_at         timestamptz not null default now(),
  last_activity_at   timestamptz not null default now(),
  last_synced_at     timestamptz
);

devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id),
  device_id     text not null,   -- client-generated, see decision 4
  label         text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (user_id, device_id)
);
```

`users` is a bare anchor (id + timestamp only) — no email, no profile.
It exists so `sync_state`/`devices` have a proper foreign key instead of
assuming a permanent singleton, not because any signup flow collects
identity today. In practice, Phase 1 ever only creates one `users` row.

### 2. Auth: rotating token, not a static secret

No signup/login flow exists, so something has to bootstrap the first
credential. Endpoints:

- **`POST /api/sync/setup`** — unauthenticated, but guarded: only
  succeeds when no `sync_state` row exists yet (true first-ever
  bootstrap). Body `{ deviceId, deviceLabel }`. Generates a random token,
  stores `token_hash` (e.g. SHA-256) in `sync_state`, inserts the first
  `devices` row, returns the plaintext token once.
- **`POST /api/sync/recover`** — unauthenticated, but guarded: only
  succeeds when the current token is idle-expired (see below). Body
  `{ deviceId }`. Issues a fresh token **only if** `deviceId` matches an
  existing row in `devices` for that user — proof this device
  successfully synced before, not just anyone who finds the endpoint.
  Unknown `deviceId` → `403`.

Every authenticated call (`pull`/`push`) does, in order:

1. Validate `token_hash` matches. Fail → `401`.
2. If `now - last_activity_at > 7 days` → mark expired, return
   `401 { reason: "expired" }` **without** doing 3–5. Client renders this
   as "sync not working since `last_activity_at`" and routes to
   `/recover`.
3. Update `last_activity_at`; touch the calling device's `last_seen_at`.
4. If `now - rotated_at > 72h` → generate a new token, store its hash,
   update `rotated_at`, and include the new plaintext token in the
   response body. Client overwrites its stored token immediately —
   refresh-on-sync, not a separate rotation call, so multi-device
   propagation happens naturally as each device syncs.
5. Proceed with the endpoint's own work (pull/push).

Rejected — deriving the token from a fixed env var set at deploy time:
simpler, but rotation would require a redeploy, and there would be no
self-service recovery path matching the "auth expired" UI state this
phase's UX explicitly wants.

### 3. Sync payload: full-library snapshot, not incremental

Sync reuses the existing backup/restore pipeline verbatim — no new merge
algorithm:

```
pull:  GET /api/sync/pull → signed Blob download URL
         → decrypt (decision 6) → readArchive() → detectConflicts()
         → [conflicts] existing conflict dialog → applyBackup(resolutions)

push:  exportLibrary() → encrypt (decision 6)
         → POST /api/sync/push → signed Blob upload URL → PUT
```

Rejected — incremental/per-book sync: would need real change-tracking
(dirty flags, deletion tombstones) that doesn't exist anywhere in
storage today, and `applyBackup`'s merge-by-`fileHash` logic isn't built
for partial payloads. Full-snapshot re-uploads unchanged EPUBs every
sync, which is an acceptable cost given decision 5 (manual trigger only
— the user controls when that cost is paid) and the stated priority that
offline-first, not sync efficiency, is what must never regress.

### 4. Device identity: client-generated ID, not a hardware identifier

`services/sync/device-id.ts` generates a random ID (`crypto.randomUUID()`
or `createId()`, matching the existing `TAB_ID` pattern in
`reading-progress-channel.ts`) on first registration and persists it in
`localStorage`. Sent with every `setup`/`recover`/`pull`/`push` call;
recorded server-side in `devices`.

Real device hardware identifiers (IMEI, serial number) are not
obtainable — browsers expose no such API to web content on any platform,
and this is a PWA, not a native app with elevated permissions. A
client-generated ID identifies the actual unit of interest anyway (a
browser storage context, which is what holds the token and the reading
progress), not the physical hardware.

Losing this ID (clearing site data) also loses the token and the
encryption key stored alongside it. `/setup` only ever works once,
globally, so a device in this state cannot re-bootstrap itself — and
`/recover` cannot help either, since it authorizes by matching a
previously-known `deviceId`, which no longer exists once storage is
cleared. Recovery in this case means manually copying the token and
encryption key over from a still-registered device; Phase 1 builds no
"invite a new device" flow beyond that manual copy. This is a known,
accepted limitation of a personal-use, no-account-recovery system — see
"Out of scope."

### 5. Trigger: manual only

A single "Sync now" action in Settings. No automatic/background sync in
Phase 1 — full-snapshot payloads can be large, this is a PWA potentially
on metered mobile data, and automatic triggering opens retry/partial-
failure edge cases (mid-read pulls, concurrent triggers) that a manual
button avoids entirely. Automatic sync is a future layer on top once
manual sync is proven reliable, not part of this phase.

### 6. Encryption: client-side, system-generated key, never sent to the server

The archive is AES-GCM encrypted (Web Crypto) client-side before
`push`, decrypted after `pull`. Vercel Blob and Postgres hold only
ciphertext — a compromised Vercel account or a Postgres leak exposes
nothing readable.

The encryption key is **not** derived from the auth token: the token
rotates every 72h (decision 2), and an archive encrypted under today's
token would become undecryptable the moment the token rotates before the
next device syncs. Instead:

- The key is **system-generated** (random, via Web Crypto), not a
  user-chosen passphrase — removes weak-passphrase risk entirely.
- Generated once, during `/setup` (or when registering an additional
  device — see decision 4's limitation), and shown to the user exactly
  once with a copy button and an explicit warning: _"This key can't be
  recovered from the server. Save it somewhere safe — you'll need it to
  register any other device."_
- The server never receives it. Its only backup is another
  already-registered device (or wherever the user chose to write it
  down) — the same trust model Signal/iCloud backup encryption use for
  their recovery keys. This is intentional, not a gap: end-to-end secrecy
  requires the server to be unable to help you if you lose the key.

**Bonus scope, same module:** `backup-encryption.ts` lives in
`services/backup/` (not `services/sync/`) specifically so it can also be
called from the existing manual `export-library.ts`/`import-backup.ts`
flow with a **user-supplied** passphrase, as an optional encrypted-export
checkbox. This is additive to the existing manual export/import UI, not
a new pipeline.

### 7. Client-side module layout

Framework-agnostic infra in `services/`, feature slice in `features/`,
Vercel's own required `api/` convention at the repo root:

```
src/services/sync/
  sync-api.ts       fetch wrappers: setup/recover/pull/push against /api/sync/*
  sync-client.ts    orchestrates pull→decrypt→merge→push (calls backup-archive + import-backup + export-library)
  device-id.ts       client-generated deviceId, persisted in localStorage

src/services/backup/
  backup-encryption.ts   encryptArchive/decryptArchive (AES-GCM) — shared by sync-client.ts AND export-library.ts/import-backup.ts

src/features/sync/                     # new vertical slice, same shape as library/preferences/reader
  store/sync-store.ts                  status: unregistered/healthy/expired, lastSyncedAt, deviceCount, syncing flag
  actions/register-device.ts           wraps /setup, stores token + encryption key locally, triggers key-once dialog
  actions/resync.ts                    wraps /recover
  actions/sync-now.ts                  drives sync-client.ts, updates sync-store from the result
  components/sync-settings-section.tsx the Settings block: Sync / Synced / Resync states
  components/encryption-key-dialog.tsx one-time "here's your key, copy it, we can't recover it" screen

api/sync/
  setup.ts  recover.ts  pull.ts  push.ts
  _lib/db.ts    Postgres client (users/sync_state/devices)
  _lib/auth.ts  shared: validate token, bump activity, rotate-if-due, expire-check
```

`sync` is its own feature slice rather than folded into `preferences`
(which already owns the rest of the Settings screen) — one clear purpose
per unit, same reasoning already applied to `library`/`reader`/
`preferences`. The Settings screen composition adds
`<SyncSettingsSection />` alongside `preferences`'s existing sections.

### 8. Settings UI: three states

- **Unregistered** — `[Sync]` button. Click → `/setup` → store token +
  deviceId + show `<EncryptionKeyDialog>` once → run first push.
- **Healthy** — `Synced — last synced at {lastSyncedAt} across {deviceCount} devices`.
- **Expired** — `Resync` button + `Sync not working since {last_activity_at}`.
  Click → `/recover` → on success, behaves like first sync after
  registration.

`{ lastSyncedAt, deviceCount }` is returned on every `pull`/`push`
response body and cached in `sync-store` — **no dedicated status
endpoint**. Given sync is manual-only (decision 5), "as of last sync" is
honest framing; a live-refreshing status call on every Settings mount
would add a network call for no benefit under a manual-trigger model.

## Data flow

```
Register (first device ever):
  Settings → [Sync] → register-device.ts
    → POST /api/sync/setup { deviceId, deviceLabel }
    → store { token, deviceId } locally
    → generate encryption key (Web Crypto) → store locally → <EncryptionKeyDialog> (copy + warning)
    → sync-now.ts (first push, see below)

Sync now (subsequent):
  Settings → [Sync now] → sync-now.ts
    → GET /api/sync/pull → { url } | 404 (nothing pushed yet)
    → [url] fetch(url) → decryptArchive() → readArchive() → BackupData
    → detectConflicts(BackupData)
    → [conflicts] existing conflict dialog → Map<localId, resolution>
    → applyBackup(BackupData, resolutions)          [unchanged from manual restore]
    → exportLibrary() → Blob                        [unchanged from manual export]
    → encryptArchive(Blob)
    → POST /api/sync/push → { url } → PUT ciphertext to url
    → sync-store updated from response { lastSyncedAt, deviceCount }
    → [response included a rotated token] overwrite stored token

Resync (after expiry):
  Settings → [Resync] → resync.ts
    → POST /api/sync/recover { deviceId }
    → [200] store new token → sync-now.ts (as above)
    → [403] toast: "This device isn't recognized — register it again from a working device."
```

## Error handling

| Failure                                                    | Behavior                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pull` with no archive ever pushed                         | `404` — client treats as "nothing to merge," skips straight to push                                                                                                          |
| Network drop mid-upload/download (signed-URL PUT/GET)      | That call fails in isolation; `sync_state`/`last_synced_at` never updates (server-side confirm didn't run), so no partial/inconsistent state. Retry = click "Sync now" again |
| `push`/`pull` with expired token                           | `401 { reason: "expired" }` → Settings flips to Resync state                                                                                                                 |
| `push`/`pull` with wrong/missing token                     | `401` → generic auth error, client prompts re-registration                                                                                                                   |
| `/setup` called when a `sync_state` row already exists     | `403` — one-time bootstrap only                                                                                                                                              |
| `/recover` called with an unknown `deviceId`               | `403` — see decision 4's device-loss limitation                                                                                                                              |
| `/recover` called while token is still valid (not expired) | `403` — recovery is only for the expired state, not a way to force-rotate                                                                                                    |
| Decryption fails (wrong/missing local encryption key)      | Surfaced as a distinct error, not conflated with "not a Librune backup" — points the user at "you need the encryption key from another registered device"                    |
| `/setup`/`/recover` abuse (no rate limiting in Phase 1)    | Accepted risk — personal, low-value-target deployment behind an unpublished URL, not a public product. See "Out of scope."                                                   |

## Out of scope

- **Rate limiting on `/setup`/`/recover`** — both are narrow, single-
  purpose, unauthenticated endpoints; accepted risk for a personal
  deployment. Revisit if this ever stops being single-user.
- **New-device onboarding beyond manual copy** — registering an
  additional device still means manually carrying over the token (or
  `/recover`, if eligible) and the encryption key from an existing
  device. No QR-code pairing, no "approve from another device" push flow.
- **Recovering a lost encryption key** — by design (decision 6); the
  server never holds it. Losing every device that has it means the
  remote archive is permanently unreadable ciphertext.
- **Automatic/background sync** — decision 5; explicit future layer, not
  built here.
- **Incremental/per-book sync** — decision 3.
- **Bookmarks/annotations in the sync payload** — deferred to Feature
  Phase 2 (manifest extension via `BACKUP_VERSION` bump).
- **Storage-02 TTL/eviction** — stays deferred until this phase is
  shipped and trusted (see Context).
- **Multi-tenant accounts, analytics/telemetry** — explicit non-goals.

## Testing

Mirrors the conventions in `2026-09-10-library-backup-and-restore-design.md`:

- **`api/sync/_lib/auth.test.ts`** — token validation, 72h rotation
  trigger (mocked clock), 7-day expiry trigger, activity bump.
- **`api/sync/setup.test.ts`** / **`recover.test.ts`** — one-time guard,
  device-match guard, rejects when not expired.
- **`services/sync/sync-client.test.ts`** — pull→merge→push orchestration
  against mocked `sync-api` responses and the real (unmocked)
  `backup-archive`/`import-backup`/`export-library` functions; 404-pull
  (nothing to merge) path; conflict path reuses the existing conflict
  fixture setup from `import-backup.test.ts`.
- **`services/backup/backup-encryption.test.ts`** — encrypt→decrypt
  round-trip byte-equal; wrong-key decrypt fails distinctly (not
  confused with "corrupt archive").
- **e2e** — deferred to implementation planning; a real two-device sync
  round-trip needs either two Playwright contexts sharing a test backend
  or a mocked API layer, decided when the plan is written.

## Sequencing

1. Postgres schema (`users`/`sync_state`/`devices`) + migration.
2. `api/sync/_lib/{db,auth}.ts` + tests (pure server logic, no Blob yet).
3. `api/sync/setup.ts` + `recover.ts` + tests.
4. `services/backup/backup-encryption.ts` + tests (independent of sync,
   unblocks both sync and the optional manual-export encryption).
5. `api/sync/pull.ts` + `push.ts` (signed Blob URLs) + tests.
6. `services/sync/{device-id,sync-api,sync-client}.ts` + tests.
7. `features/sync/` (store, actions, Settings UI, encryption-key dialog).
8. Optional-encryption checkbox added to the existing manual
   Export/Import UI, reusing `backup-encryption.ts`.
9. e2e coverage (shape decided at implementation-planning time).
10. Update `CLAUDE.md` architecture section (new `services/sync/`,
    `features/sync/`, `api/` directory) and `central-docs/09 - Feature
Phase 1 - Sync & Cross-Device/`.
