import { neon } from "@neondatabase/serverless";

import type { DeviceRow, InviteRow, SyncStateRow, UserRow } from "./db-types";

// The one file that imports the driver. Everything else goes through `query`,
// so tests swap in pglite via `setQuery` and a provider move only touches this file.
export type Query = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;

let query: Query | undefined;

export function setQuery(q: Query): void {
  query = q;
}

function getQuery(): Query {
  if (!query) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const sql = neon(url);
    query = (text, params) => sql.query(text, params);
  }
  return query;
}

async function rows<T>(sql: string, params: unknown[]): Promise<T[]> {
  return (await getQuery()(sql, params)) as T[];
}

async function one<T>(sql: string, params: unknown[]): Promise<T | undefined> {
  return (await rows<T>(sql, params))[0];
}

export async function insertUser(invited: boolean): Promise<UserRow> {
  return (await one<UserRow>(
    "INSERT INTO users (invited) VALUES ($1) RETURNING *",
    [invited],
  ))!;
}

export function getUser(id: string): Promise<UserRow | undefined> {
  return one("SELECT * FROM users WHERE id = $1", [id]);
}

export async function insertSyncState(
  userId: string,
  registrationProofHash: string,
): Promise<SyncStateRow> {
  return (await one<SyncStateRow>(
    "INSERT INTO sync_state (user_id, registration_proof_hash) VALUES ($1, $2) RETURNING *",
    [userId, registrationProofHash],
  ))!;
}

export function getSyncState(
  userId: string,
): Promise<SyncStateRow | undefined> {
  return one("SELECT * FROM sync_state WHERE user_id = $1", [userId]);
}

export async function insertInvite(
  invite: Pick<
    InviteRow,
    "code_hash" | "created_by" | "created_at" | "expires_at"
  >,
): Promise<InviteRow> {
  return (await one<InviteRow>(
    "INSERT INTO invites (code_hash, created_by, created_at, expires_at) VALUES ($1, $2, $3, $4) RETURNING *",
    [invite.code_hash, invite.created_by, invite.created_at, invite.expires_at],
  ))!;
}

export function getInvite(codeHash: string): Promise<InviteRow | undefined> {
  return one("SELECT * FROM invites WHERE code_hash = $1", [codeHash]);
}

export async function insertDevice(
  device: Omit<DeviceRow, "prev_token_hash">,
): Promise<DeviceRow> {
  return (await one<DeviceRow>(
    `INSERT INTO devices (device_id, user_id, label, token_hash, token_rotated_at, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      device.device_id,
      device.user_id,
      device.label,
      device.token_hash,
      device.token_rotated_at,
      device.first_seen_at,
      device.last_seen_at,
    ],
  ))!;
}

export function getDevice(deviceId: string): Promise<DeviceRow | undefined> {
  return one("SELECT * FROM devices WHERE device_id = $1", [deviceId]);
}

// Successful check with the current token: ends the previous token's grace (D8) and bumps activity.
export async function touchDevice(deviceId: string, now: Date): Promise<void> {
  await rows(
    "UPDATE devices SET prev_token_hash = NULL, last_seen_at = $2 WHERE device_id = $1",
    [deviceId, now],
  );
}

// Compare-and-swap on the current hash, so two requests racing to rotate cannot
// both win. Returns false when another request already rotated.
export async function rotateDeviceToken(
  deviceId: string,
  currentHash: string,
  newHash: string,
  now: Date,
): Promise<boolean> {
  const updated = await rows(
    `UPDATE devices
     SET prev_token_hash = token_hash, token_hash = $3, token_rotated_at = $4, last_seen_at = $4
     WHERE device_id = $1 AND token_hash = $2 RETURNING device_id`,
    [deviceId, currentHash, newHash, now],
  );
  return updated.length > 0;
}

// Previous-token retry that needs no rotation: bump activity only, keep the grace.
export async function bumpDeviceActivity(
  deviceId: string,
  now: Date,
): Promise<void> {
  await rows("UPDATE devices SET last_seen_at = $2 WHERE device_id = $1", [
    deviceId,
    now,
  ]);
}

export interface NewUser {
  userId: string;
  proofHash: string;
  deviceId: string;
  label: string;
  tokenHash: string;
  now: Date;
}

// One statement creates the user, its sync_state and its first device, so a
// failure never leaves a user nobody can sign in as. With `inviteHash` the same
// statement consumes an unused, unexpired invite and creates nothing when there
// is none (returns false). Without it the user is uninvited, and the
// `users_single_uninvited` index (23505) rejects a second one even when setups race.
export async function createUserWithDevice(
  u: NewUser,
  inviteHash?: string,
): Promise<boolean> {
  const params: unknown[] = [
    u.userId,
    u.proofHash,
    u.deviceId,
    u.label,
    u.tokenHash,
    u.now,
  ];
  const gate = inviteHash
    ? `inv AS (
         UPDATE invites SET used_at = $6, used_by = $1
         WHERE code_hash = $7 AND used_at IS NULL AND expires_at > $6
         RETURNING code_hash
       ),
       u AS (INSERT INTO users (id, invited) SELECT $1, true FROM inv RETURNING id)`
    : "u AS (INSERT INTO users (id, invited) VALUES ($1, false) RETURNING id)";
  if (inviteHash) params.push(inviteHash);
  const created = await rows(
    `WITH ${gate},
     s AS (INSERT INTO sync_state (user_id, registration_proof_hash) SELECT id, $2 FROM u),
     d AS (
       INSERT INTO devices (device_id, user_id, label, token_hash, token_rotated_at, first_seen_at, last_seen_at)
       SELECT $3, id, $4, $5, $6, $6, $6 FROM u
     )
     SELECT id FROM u`,
    params,
  );
  return created.length > 0;
}

export interface NewDevice {
  userId: string;
  proofHash: string;
  deviceId: string;
  label: string;
  tokenHash: string;
  now: Date;
}

// Adds a device only when the user's registration proof matches, in one
// statement. Returns false for an unknown user or a wrong proof; a taken
// `deviceId` raises `devices_pkey` (23505).
export async function createDeviceWithProof(d: NewDevice): Promise<boolean> {
  const created = await rows(
    `INSERT INTO devices (device_id, user_id, label, token_hash, token_rotated_at, first_seen_at, last_seen_at)
     SELECT $3, user_id, $4, $5, $6, $6, $6 FROM sync_state
     WHERE user_id = $1 AND registration_proof_hash = $2
     RETURNING device_id`,
    [d.userId, d.proofHash, d.deviceId, d.label, d.tokenHash, d.now],
  );
  return created.length > 0;
}
