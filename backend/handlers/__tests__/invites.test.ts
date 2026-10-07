// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { INVITE_EXPIRY_MS } from "../../../contracts/auth-constants";
import { errorResponseSchema } from "../../../contracts/errors";
import { invitesResponseSchema } from "../../../contracts/invites";
import { setupResponseSchema } from "../../../contracts/setup";
import { createTestDb } from "../../tests/test-db";
import { handleInvites } from "../invites";
import { handleSetup } from "../setup";

const NOW = new Date("2026-09-28T10:00:00.000Z");
let pg: PGlite;
let creds: { deviceId: string; token: string };

beforeAll(async () => {
  pg = await createTestDb();
  const res = await handleSetup(
    new Request("http://x/api/setup", {
      method: "POST",
      body: JSON.stringify({ deviceId: "d1", label: "L", proof: "p" }),
    }),
    NOW,
  );
  creds = {
    deviceId: "d1",
    token: setupResponseSchema.parse(await res.json()).token,
  };
});
afterAll(async () => {
  await pg.close();
});

function call(headers: Record<string, string>, now = NOW) {
  return handleInvites(
    new Request("http://x/api/invites", { method: "POST", headers }),
    now,
  );
}

describe("invites", () => {
  it("mints a code an invited user can set up with", async () => {
    const res = await call({
      "X-Device-Id": creds.deviceId,
      Authorization: `Bearer ${creds.token}`,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = invitesResponseSchema.parse(await res.json());
    expect(body.code).toMatch(/^([A-Z2-7]{4}-){3}[A-Z2-7]{4}$/);
    expect(body.expiresAt).toBe(
      new Date(NOW.getTime() + INVITE_EXPIRY_MS).toISOString(),
    );

    const joined = await handleSetup(
      new Request("http://x/api/setup", {
        method: "POST",
        body: JSON.stringify({
          deviceId: "d2",
          label: "L",
          proof: "p",
          inviteCode: body.code,
        }),
      }),
      NOW,
    );
    expect(joined.status).toBe(200);
  });

  it("rejects missing and wrong credentials", async () => {
    const bad: Record<string, string>[] = [
      {},
      { "X-Device-Id": "d1", Authorization: "Bearer nope" },
    ];
    for (const headers of bad) {
      const res = await call(headers);
      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(await res.json()).error.code).toBe(
        "invalid_credentials",
      );
    }
  });

  it("rejects an idle-expired caller", async () => {
    const res = await call(
      {
        "X-Device-Id": creds.deviceId,
        Authorization: `Bearer ${creds.token}`,
      },
      new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
    );
    expect(res.status).toBe(401);
    expect(errorResponseSchema.parse(await res.json()).error.code).toBe(
      "token_expired",
    );
  });
});
