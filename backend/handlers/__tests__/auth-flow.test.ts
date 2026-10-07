// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { POST as recoverRoute } from "../../../api/recover";
import { POST as registerRoute } from "../../../api/register";
import { POST as invitesRoute } from "../../../api/invites";
import { POST as setupRoute } from "../../../api/setup";
import { DEVICE_IDLE_EXPIRY_MS } from "../../../contracts/auth-constants";
import { ERROR_STATUS, errorResponseSchema } from "../../../contracts/errors";
import { invitesResponseSchema } from "../../../contracts/invites";
import { recoverResponseSchema } from "../../../contracts/recover";
import {
  registerRequestSchema,
  registerResponseSchema,
} from "../../../contracts/register";
import { setupResponseSchema } from "../../../contracts/setup";
import { createTestDb } from "../../tests/test-db";
import { handleInvites } from "../invites";
import { handleRecover } from "../recover";
import { handleRegister } from "../register";
import { handleSetup } from "../setup";

const NOW = new Date("2026-09-28T10:00:00.000Z");
let pg: PGlite;

beforeAll(async () => {
  pg = await createTestDb();
});
afterAll(async () => {
  await pg.close();
});

type Handler = (req: Request, now?: Date) => Promise<Response>;
function call(
  handler: Handler,
  { body, headers }: { body?: object; headers?: Record<string, string> },
  now = NOW,
) {
  return handler(
    new Request("http://x", {
      method: "POST",
      body: body && JSON.stringify(body),
      headers,
    }),
    now,
  );
}
const bearer = (deviceId: string, token: string) => ({
  "X-Device-Id": deviceId,
  Authorization: `Bearer ${token}`,
});
// Every error response carries its D10 code with that code's status.
async function expectError(res: Response, code: keyof typeof ERROR_STATUS) {
  expect(res.status).toBe(ERROR_STATUS[code]);
  expect(errorResponseSchema.parse(await res.json()).error.code).toBe(code);
}

describe("route wiring", () => {
  it("each api route exports its handler as POST", () => {
    expect(setupRoute).toBe(handleSetup);
    expect(invitesRoute).toBe(handleInvites);
    expect(registerRoute).toBe(handleRegister);
    expect(recoverRoute).toBe(handleRecover);
  });
});

describe("register contract", () => {
  it("requires a uuid userId", () => {
    const ok = {
      userId: crypto.randomUUID(),
      deviceId: "d",
      label: "l",
      proof: "p",
    };
    expect(registerRequestSchema.safeParse(ok).success).toBe(true);
    expect(
      registerRequestSchema.safeParse({ ...ok, userId: "x" }).success,
    ).toBe(false);
  });
});

describe("first user -> invite -> second user -> register -> recover", () => {
  it("runs end to end, and one user's credentials never reach another's rows", async () => {
    // first user sets up and mints an invite
    const a = setupResponseSchema.parse(
      await (
        await call(handleSetup, {
          body: { deviceId: "a1", label: "A laptop", proof: "proof-a" },
        })
      ).json(),
    );
    const { code } = invitesResponseSchema.parse(
      await (
        await call(handleInvites, { headers: bearer("a1", a.token) })
      ).json(),
    );

    // invited user sets up
    const b = setupResponseSchema.parse(
      await (
        await call(handleSetup, {
          body: {
            deviceId: "b1",
            label: "B laptop",
            proof: "proof-b",
            inviteCode: code,
          },
        })
      ).json(),
    );
    expect(b.userId).not.toBe(a.userId);

    // A's proof cannot add a device to B; B's token cannot recover A's device
    await expectError(
      await call(handleRegister, {
        body: {
          userId: b.userId,
          deviceId: "x1",
          label: "x",
          proof: "proof-a",
        },
      }),
      "registration_rejected",
    );
    await expectError(
      await call(
        handleRecover,
        { headers: bearer("a1", b.token) },
        new Date(NOW.getTime() + DEVICE_IDLE_EXPIRY_MS + 1000),
      ),
      "invalid_credentials",
    );

    // second device registers for the first user
    const reg = registerResponseSchema.parse(
      await (
        await call(handleRegister, {
          body: {
            userId: a.userId,
            deviceId: "a2",
            label: "A phone",
            proof: "proof-a",
          },
        })
      ).json(),
    );

    // a2 idles out and recovers; the recovered token works
    const later = new Date(NOW.getTime() + DEVICE_IDLE_EXPIRY_MS + 1000);
    const rec = recoverResponseSchema.parse(
      await (
        await call(handleRecover, { headers: bearer("a2", reg.token) }, later)
      ).json(),
    );
    const res = await call(
      handleInvites,
      { headers: bearer("a2", rec.token) },
      later,
    );
    expect(res.status).toBe(200);
  });
});
