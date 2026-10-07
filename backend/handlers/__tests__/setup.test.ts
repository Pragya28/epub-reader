// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { errorResponseSchema } from "../../../contracts/errors";
import { setupResponseSchema } from "../../../contracts/setup";
import { hashInviteCode } from "../../auth/invite-code";
import { insertInvite } from "../../db/db";
import { createTestDb } from "../../tests/test-db";
import { POST } from "../setup";

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
  return POST(
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
