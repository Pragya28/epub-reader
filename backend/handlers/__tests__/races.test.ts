// @vitest-environment node
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEVICE_IDLE_EXPIRY_MS,
  TOKEN_ROTATION_MS,
} from "../../../contracts/auth-constants";
import { errorResponseSchema } from "../../../contracts/errors";
import { authenticate, hashToken, issueToken } from "../../auth/auth";
import { hashInviteCode } from "../../auth/invite-code";
import { getDevice, insertDevice, insertInvite } from "../../db/db";
import { createPgTestDb } from "../../tests/pg-db";
import { handleRecover } from "../recover";
import { handleSetup } from "../setup";

// Single-connection pglite can't interleave, so these run against a real
// Postgres and are skipped without TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;
const N = 8;
const T0 = new Date("2026-09-28T10:00:00.000Z");

let pool: pg.Pool;
let firstUserId: string;
let n = 0;

beforeAll(async () => {
  if (url) pool = await createPgTestDb(url);
});
afterAll(async () => {
  await pool?.end();
});

function setup(inviteCode?: string) {
  return handleSetup(
    new Request("http://x/api/setup", {
      method: "POST",
      body: JSON.stringify({
        deviceId: `dev-${n++}`,
        label: "Laptop",
        proof: "proof",
        inviteCode,
      }),
    }),
    T0,
  );
}

async function codes(responses: Response[]) {
  return Promise.all(
    responses.map(async (r) =>
      r.status === 200
        ? "ok"
        : errorResponseSchema.parse(await r.json()).error.code,
    ),
  );
}

async function newDevice(lastSeen = T0) {
  const token = issueToken();
  const deviceId = `device-${n++}`;
  await insertDevice({
    device_id: deviceId,
    user_id: firstUserId,
    label: "test",
    token_hash: hashToken(token),
    token_rotated_at: lastSeen,
    first_seen_at: lastSeen,
    last_seen_at: lastSeen,
  });
  return { deviceId, token };
}

describe.skipIf(!url)("races (real Postgres)", () => {
  it("lets exactly one of N concurrent first-user setups through", async () => {
    const results = await codes(
      await Promise.all(Array.from({ length: N }, () => setup())),
    );
    expect(results.filter((c) => c === "ok")).toHaveLength(1);
    expect(results.filter((c) => c === "invite_required")).toHaveLength(N - 1);
    const { rows } = await pool.query("SELECT id FROM users");
    expect(rows).toHaveLength(1);
    firstUserId = rows[0].id;
  });

  it("lets exactly one of N concurrent setups consume the same invite", async () => {
    await insertInvite({
      code_hash: hashInviteCode("ABCD-EFGH-JKLM-NPQR"),
      created_by: firstUserId,
      created_at: T0,
      expires_at: new Date(T0.getTime() + 60_000),
    });
    const results = await codes(
      await Promise.all(
        Array.from({ length: N }, () => setup("ABCD-EFGH-JKLM-NPQR")),
      ),
    );
    expect(results.filter((c) => c === "ok")).toHaveLength(1);
    expect(results.filter((c) => c === "invite_invalid")).toHaveLength(N - 1);
    const { rows } = await pool.query("SELECT id FROM users WHERE invited");
    expect(rows).toHaveLength(1);
  });

  it("issues exactly one new token when N requests rotate one device", async () => {
    const { deviceId, token } = await newDevice();
    const now = new Date(T0.getTime() + TOKEN_ROTATION_MS + 1000);
    const results = await Promise.all(
      Array.from({ length: N }, () => authenticate(deviceId, token, now)),
    );
    const issued = results.flatMap((r) => (r.token ? [r.token] : []));
    expect(issued).toHaveLength(1);
    expect((await getDevice(deviceId))?.token_hash).toBe(hashToken(issued[0]));
  });

  it("settles on one current token when recover overlaps a rotation", async () => {
    const { deviceId, token } = await newDevice();
    const rotateAt = new Date(T0.getTime() + TOKEN_ROTATION_MS + 1000);
    const recoverAt = new Date(T0.getTime() + DEVICE_IDLE_EXPIRY_MS + 1000);
    const [rotated, recovered] = await Promise.all([
      authenticate(deviceId, token, rotateAt),
      handleRecover(
        new Request("http://x/api/recover", {
          method: "POST",
          headers: {
            "X-Device-Id": deviceId,
            Authorization: `Bearer ${token}`,
          },
        }),
        recoverAt,
      ),
    ]);
    const issued = [
      ...(rotated.token ? [rotated.token] : []),
      ...(recovered.status === 200
        ? [((await recovered.json()) as { token: string }).token]
        : []),
    ];
    expect(issued.length).toBeGreaterThanOrEqual(1);
    // whichever won, the stored current token is one that was actually issued
    expect(issued.map(hashToken)).toContain(
      (await getDevice(deviceId))?.token_hash,
    );
  });
});
