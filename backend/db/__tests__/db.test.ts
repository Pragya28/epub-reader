// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../tests/test-db";
import {
  getDevice,
  getInvite,
  getSyncState,
  getUser,
  insertDevice,
  insertInvite,
  insertSyncState,
  insertUser,
} from "../db";

const NOW = new Date("2026-09-28T10:00:00.000Z");
const IN_7_DAYS = new Date("2026-10-05T10:00:00.000Z");

let pg: PGlite;

beforeAll(async () => {
  pg = await createTestDb();
});

afterAll(async () => {
  await pg.close();
});

describe("migrations", () => {
  it("create the four tables", async () => {
    const { rows } = await pg.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "devices",
      "invites",
      "sync_state",
      "users",
    ]);
  });
});

// Round-trip users are invited: the first-user guard allows only one uninvited user per database.
describe("db.ts round-trip", () => {
  it("users", async () => {
    const user = await insertUser(true);
    expect(user).toEqual({
      id: expect.any(String),
      created_at: expect.any(Date),
      invited: true,
    });
    expect(await getUser(user.id)).toEqual(user);
  });

  it("sync_state", async () => {
    const user = await insertUser(true);
    const state = await insertSyncState(user.id, "proof-hash");
    expect(state).toEqual({
      user_id: user.id,
      registration_proof_hash: "proof-hash",
      last_synced_at: null,
    });
    expect(await getSyncState(user.id)).toEqual(state);
  });

  it("invites", async () => {
    const user = await insertUser(true);
    const invite = await insertInvite({
      code_hash: "code-hash",
      created_by: user.id,
      created_at: NOW,
      expires_at: IN_7_DAYS,
    });
    expect(invite).toEqual({
      code_hash: "code-hash",
      created_by: user.id,
      created_at: NOW,
      expires_at: IN_7_DAYS,
      used_at: null,
      used_by: null,
    });
    expect(await getInvite("code-hash")).toEqual(invite);
  });

  it("devices", async () => {
    const user = await insertUser(true);
    const device = await insertDevice({
      device_id: "device-1",
      user_id: user.id,
      label: "Phone",
      token_hash: "token-hash",
      token_rotated_at: NOW,
      first_seen_at: NOW,
      last_seen_at: NOW,
    });
    expect(device).toEqual({
      device_id: "device-1",
      user_id: user.id,
      label: "Phone",
      token_hash: "token-hash",
      prev_token_hash: null,
      token_rotated_at: NOW,
      first_seen_at: NOW,
      last_seen_at: NOW,
    });
    expect(await getDevice("device-1")).toEqual(device);
  });

  it("get returns undefined for a missing row", async () => {
    const missingId = "00000000-0000-0000-0000-000000000000";
    expect(await getUser(missingId)).toBeUndefined();
    expect(await getSyncState(missingId)).toBeUndefined();
    expect(await getInvite("missing")).toBeUndefined();
    expect(await getDevice("missing")).toBeUndefined();
  });
});

describe("first-user guard", () => {
  it("allows one uninvited user and any number of invited ones", async () => {
    await insertUser(false);
    await expect(insertUser(false)).rejects.toThrow("users_single_uninvited");
    await expect(insertUser(true)).resolves.toMatchObject({ invited: true });
  });
});
