// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { errorResponseSchema } from "../../../contracts/errors";
import { registerResponseSchema } from "../../../contracts/register";
import { setupResponseSchema } from "../../../contracts/setup";
import { hashToken } from "../../auth/auth";
import { getDevice } from "../../db/db";
import { createTestDb } from "../../tests/test-db";
import { handleRegister } from "../register";
import { handleSetup } from "../setup";

const NOW = new Date("2026-09-28T10:00:00.000Z");
let pg: PGlite;
let userId: string;
let firstToken: string;

function post(handler: typeof handleSetup, body: object) {
  return handler(
    new Request("http://x", { method: "POST", body: JSON.stringify(body) }),
    NOW,
  );
}
const register = (extra: object = {}) =>
  post(handleRegister, {
    userId,
    deviceId: "second",
    label: "Phone",
    proof: "proof",
    ...extra,
  });
const code = async (res: Response) =>
  errorResponseSchema.parse(await res.json()).error.code;

beforeAll(async () => {
  pg = await createTestDb();
  const res = await post(handleSetup, {
    deviceId: "first",
    label: "Laptop",
    proof: "proof",
  });
  ({ userId, token: firstToken } = setupResponseSchema.parse(await res.json()));
});
afterAll(async () => {
  await pg.close();
});

describe("register", () => {
  it("rejects a wrong proof and an unknown user identically", async () => {
    const wrong = await register({ proof: "nope", deviceId: "d1" });
    const unknown = await register({
      userId: crypto.randomUUID(),
      deviceId: "d2",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await code(wrong)).toBe("registration_rejected");
    expect(await code(unknown)).toBe("registration_rejected");
  });

  it("gives the new device its own token and leaves existing devices alone", async () => {
    const res = await register();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const { token } = registerResponseSchema.parse(await res.json());
    expect(token).not.toBe(firstToken);
    expect((await getDevice("second"))?.token_hash).toBe(hashToken(token));
    expect((await getDevice("first"))?.token_hash).toBe(hashToken(firstToken));
  });

  it("rejects an already-registered deviceId", async () => {
    const res = await register();
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("device_exists");
  });

  it("rejects a malformed body", async () => {
    const res = await post(handleRegister, { userId: "x" });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("invalid_request");
  });
});
