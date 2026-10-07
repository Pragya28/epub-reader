// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { errorResponseSchema } from "../../../contracts/errors";
import { setupResponseSchema } from "../../../contracts/setup";
import { hashInviteCode } from "../../auth/invite-code";
import { insertInvite } from "../../db/db";
import { createTestDb } from "../../tests/test-db";
import { handleSetup } from "../setup";

const NOW = new Date("2026-09-28T10:00:00.000Z");
let pg: PGlite;
let n = 0;

beforeAll(async () => {
  pg = await createTestDb();
});
afterAll(async () => {
  await pg.close();
});

function setup(extra: object = {}) {
  return handleSetup(
    new Request("http://x/api/setup", {
      method: "POST",
      body: JSON.stringify({
        deviceId: `dev-${n++}`,
        label: "Laptop",
        proof: "proof",
        ...extra,
      }),
    }),
    NOW,
  );
}

describe("setup", () => {
  it("creates the first user without an invite, then requires one", async () => {
    const res = await setup();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const first = setupResponseSchema.parse(await res.json());

    const again = await setup();
    expect(again.status).toBe(409);
    expect(errorResponseSchema.parse(await again.json()).error.code).toBe(
      "invite_required",
    );

    // an invited user can set up with a code from the first user
    await insertInvite({
      code_hash: hashInviteCode("ABCD-EFGH-JKLM-NPQR"),
      created_by: first.userId,
      created_at: NOW,
      expires_at: new Date(NOW.getTime() + 1000),
    });
    const invited = await setup({ inviteCode: "abcd efgh jklm npqr" });
    expect(invited.status).toBe(200);
    setupResponseSchema.parse(await invited.json());
  });

  it("rejects an unknown or used invite as invite_invalid", async () => {
    const res = await setup({ inviteCode: "NOPE" });
    expect(res.status).toBe(401);
    expect(errorResponseSchema.parse(await res.json()).error.code).toBe(
      "invite_invalid",
    );
    const used = await setup({ inviteCode: "ABCD-EFGH-JKLM-NPQR" });
    expect(errorResponseSchema.parse(await used.json()).error.code).toBe(
      "invite_invalid",
    );
  });

  it("rejects a malformed body", async () => {
    const res = await setup({ label: "" });
    expect(res.status).toBe(400);
  });
});

async function mintInvite(code: string, expiresAt: Date) {
  const { rows } = await pg.query<{ id: string }>(
    "SELECT id FROM users LIMIT 1",
  );
  await insertInvite({
    code_hash: hashInviteCode(code),
    created_by: rows[0].id,
    created_at: NOW,
    expires_at: expiresAt,
  });
}

async function errorOf(res: Response) {
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  return {
    status: res.status,
    ...errorResponseSchema.parse(await res.json()).error,
  };
}

describe("setup errors", () => {
  it("rejects an expired invite with the same invite_invalid as an unknown one", async () => {
    await setup(); // ensure a user exists even if run alone
    await mintInvite("EXPIRED-CODE", new Date(NOW.getTime() - 1));
    const expired = await errorOf(await setup({ inviteCode: "EXPIRED-CODE" }));
    const unknown = await errorOf(await setup({ inviteCode: "NO-SUCH-CODE" }));
    expect(expired).toEqual(unknown);
    expect(expired).toMatchObject({ status: 401, code: "invite_invalid" });
  });

  it("lets exactly one of two concurrent setups use an invite", async () => {
    await mintInvite("ONCE-ONLY", new Date(NOW.getTime() + 1000));
    const results = await Promise.all([
      setup({ inviteCode: "ONCE-ONLY" }),
      setup({ inviteCode: "ONCE-ONLY" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it("rejects a deviceId that is already registered", async () => {
    await mintInvite("DEVICE-DUP", new Date(NOW.getTime() + 1000));
    await mintInvite("DEVICE-DUP-2", new Date(NOW.getTime() + 1000));
    expect(
      (await setup({ deviceId: "dup", inviteCode: "DEVICE-DUP" })).status,
    ).toBe(200);
    const dup = await errorOf(
      await setup({ deviceId: "dup", inviteCode: "DEVICE-DUP-2" }),
    );
    expect(dup).toMatchObject({ status: 409, code: "device_exists" });
  });

  it("rejects malformed bodies with invalid_request", async () => {
    const raw = (body: string) =>
      handleSetup(
        new Request("http://x/api/setup", { method: "POST", body }),
        NOW,
      );
    for (const res of [
      await raw("not json"),
      await raw("{}"),
      await setup({ proof: undefined }),
      await setup({ deviceId: "x".repeat(129) }),
    ]) {
      expect(await errorOf(res)).toMatchObject({
        status: 400,
        code: "invalid_request",
      });
    }
  });

  it("returns invite_required as 409 with no-store", async () => {
    expect(await errorOf(await setup())).toMatchObject({
      status: 409,
      code: "invite_required",
    });
  });
});
