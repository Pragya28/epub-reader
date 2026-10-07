// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  DEVICE_IDLE_EXPIRY_MS,
  TOKEN_ROTATION_MS,
} from "../../../contracts/auth-constants";
import { createTestDb } from "../../tests/test-db";
import { getDevice, insertDevice, insertUser } from "../../db/db";
import { AuthError, authenticate, hashToken, issueToken } from "../auth";

const T0 = new Date("2026-09-28T10:00:00.000Z");
const after = (ms: number) => new Date(T0.getTime() + ms);

let pg: PGlite;
let userId: string;
let n = 0;

beforeAll(async () => {
  pg = await createTestDb();
  userId = (await insertUser(false)).id;
});

afterAll(async () => {
  await pg.close();
});

async function newDevice() {
  const deviceId = `device-${n++}`;
  const token = issueToken();
  await insertDevice({
    device_id: deviceId,
    user_id: userId,
    label: "test",
    token_hash: hashToken(token),
    token_rotated_at: T0,
    first_seen_at: T0,
    last_seen_at: T0,
  });
  return { deviceId, token };
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as AuthError).code;
  }
}

describe("authenticate", () => {
  it("accepts the current token and returns the user without a new token", async () => {
    const { deviceId, token } = await newDevice();
    expect(await authenticate(deviceId, token, after(1000))).toEqual({
      userId,
    });
  });

  it("bumps last_seen_at on every successful check", async () => {
    const { deviceId, token } = await newDevice();
    await authenticate(deviceId, token, after(1000));
    expect((await getDevice(deviceId))!.last_seen_at).toEqual(after(1000));
    await authenticate(deviceId, token, after(2000));
    expect((await getDevice(deviceId))!.last_seen_at).toEqual(after(2000));
  });

  it("rejects a wrong token and an unknown device alike", async () => {
    const { deviceId } = await newDevice();
    expect(await codeOf(authenticate(deviceId, issueToken(), T0))).toBe(
      "invalid_credentials",
    );
    expect(await codeOf(authenticate("nope", issueToken(), T0))).toBe(
      "invalid_credentials",
    );
  });

  it("rejects another device's token", async () => {
    const a = await newDevice();
    const b = await newDevice();
    expect(await codeOf(authenticate(a.deviceId, b.token, T0))).toBe(
      "invalid_credentials",
    );
  });

  it("does not rotate at exactly 72h, rotates past it", async () => {
    const { deviceId, token } = await newDevice();
    expect(
      (await authenticate(deviceId, token, after(TOKEN_ROTATION_MS))).token,
    ).toBeUndefined();

    const next = (
      await authenticate(deviceId, token, after(TOKEN_ROTATION_MS + 1))
    ).token;
    expect(next).toBeDefined();
    const row = (await getDevice(deviceId))!;
    expect(row.token_hash).toBe(hashToken(next!));
    expect(row.prev_token_hash).toBe(hashToken(token));
    expect(row.token_rotated_at).toEqual(after(TOKEN_ROTATION_MS + 1));
  });

  it("accepts the previous token as a retry and answers with a current token", async () => {
    const { deviceId, token } = await newDevice();
    const lost = (
      await authenticate(deviceId, token, after(TOKEN_ROTATION_MS + 1))
    ).token!;

    const retry = await authenticate(
      deviceId,
      token,
      after(TOKEN_ROTATION_MS + 2),
    );
    expect(retry.token).toBeDefined();

    // The device now holds the answer to its retry; using it ends the grace.
    expect(
      await authenticate(deviceId, retry.token!, after(TOKEN_ROTATION_MS + 3)),
    ).toEqual({ userId });
    expect((await getDevice(deviceId))!.prev_token_hash).toBeNull();
    expect(
      await codeOf(authenticate(deviceId, token, after(TOKEN_ROTATION_MS + 4))),
    ).toBe("invalid_credentials");
    expect(lost).not.toBe(retry.token);
  });

  it("clears the previous token on the first use of the current one", async () => {
    const { deviceId, token } = await newDevice();
    const next = (
      await authenticate(deviceId, token, after(TOKEN_ROTATION_MS + 1))
    ).token!;
    await authenticate(deviceId, next, after(TOKEN_ROTATION_MS + 2));
    expect((await getDevice(deviceId))!.prev_token_hash).toBeNull();
    expect(
      await codeOf(authenticate(deviceId, token, after(TOKEN_ROTATION_MS + 3))),
    ).toBe("invalid_credentials");
  });

  it("expires at 7 days idle, not before", async () => {
    const { deviceId, token } = await newDevice();
    await authenticate(deviceId, token, after(DEVICE_IDLE_EXPIRY_MS));
    expect(
      await codeOf(
        authenticate(deviceId, token, after(DEVICE_IDLE_EXPIRY_MS * 2 + 1)),
      ),
    ).toBe("token_expired");
  });

  it("measures idle time from the last successful check", async () => {
    const { deviceId, token } = await newDevice();
    await authenticate(deviceId, token, after(DEVICE_IDLE_EXPIRY_MS - 1));
    // 7 days after the first check's predecessor but < 7 days after the last one.
    expect(
      await authenticate(deviceId, token, after(DEVICE_IDLE_EXPIRY_MS * 2 - 2)),
    ).toBeDefined();
  });

  it("expires the previous token on the same idle clock", async () => {
    const { deviceId, token } = await newDevice();
    await authenticate(deviceId, token, after(TOKEN_ROTATION_MS + 1));
    expect(
      await codeOf(
        authenticate(
          deviceId,
          token,
          after(TOKEN_ROTATION_MS + 1 + DEVICE_IDLE_EXPIRY_MS + 1),
        ),
      ),
    ).toBe("token_expired");
  });

  it("does not reveal expiry to a wrong token", async () => {
    const { deviceId } = await newDevice();
    expect(
      await codeOf(
        authenticate(deviceId, issueToken(), after(DEVICE_IDLE_EXPIRY_MS + 1)),
      ),
    ).toBe("invalid_credentials");
  });
});
