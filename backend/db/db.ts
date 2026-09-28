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
