// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { DEVICE_IDLE_EXPIRY_MS } from "../../../contracts/auth-constants";
import { errorResponseSchema } from "../../../contracts/errors";
import { recoverResponseSchema } from "../../../contracts/recover";
import { setupResponseSchema } from "../../../contracts/setup";
import { hashToken } from "../../auth/auth";
import { getDevice } from "../../db/db";
import { createTestDb } from "../../tests/test-db";
import { handleRecover } from "../recover";
import { handleSetup } from "../setup";

const NOW = new Date("2026-09-28T10:00:00.000Z");
const EXPIRED = new Date(NOW.getTime() + DEVICE_IDLE_EXPIRY_MS + 1000);
let pg: PGlite;
let token: string;

function recover(
  headers: Record<string, string>,
  now: Date,
): Promise<Response> {
  return handleRecover(
    new Request("http://x/api/recover", { method: "POST", headers }),
    now,
  );
}
const creds = (deviceId = "first", t = token) => ({
  "X-Device-Id": deviceId,
  Authorization: `Bearer ${t}`,
});
const code = async (res: Response) =>
  errorResponseSchema.parse(await res.json()).error.code;

beforeAll(async () => {
  pg = await createTestDb();
  const res = await handleSetup(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify({
        deviceId: "first",
        label: "Laptop",
        proof: "proof",
      }),
    }),
    NOW,
  );
  ({ token } = setupResponseSchema.parse(await res.json()));
});
afterAll(async () => {
  await pg.close();
});

describe("recover", () => {
  it("rejects missing credentials, an unknown device and a mismatched token", async () => {
    for (const headers of [
      {},
      creds("nobody"),
      creds("first", "wrong-token"),
    ]) {
      const res = await recover(headers, EXPIRED);
      expect(res.status).toBe(401);
      expect(await code(res)).toBe("invalid_credentials");
    }
  });

  it("rejects a device that is not idle-expired", async () => {
    const res = await recover(creds(), NOW);
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("not_expired");
  });

  it("issues a fresh token to an expired device, once", async () => {
    const res = await recover(creds(), EXPIRED);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const { token: fresh } = recoverResponseSchema.parse(await res.json());
    expect(fresh).not.toBe(token);
    const row = await getDevice("first");
    expect(row?.token_hash).toBe(hashToken(fresh));
    expect(row?.last_seen_at).toEqual(EXPIRED);

    // the old token no longer matches the current row and the device is live again
    const again = await recover(creds(), EXPIRED);
    expect(again.status).toBe(401);
  });
});
