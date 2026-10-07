import { randomUUID } from "node:crypto";

import {
  setupRequestSchema,
  type SetupResponse,
} from "../../contracts/setup.ts";
import { hashInviteCode } from "../auth/invite-code.ts";
import { hashToken, issueToken } from "../auth/auth.ts";
import { createUserWithDevice } from "../db/db.ts";
import { constraintOf, errorResponse, json, parseBody } from "./http.ts";

export async function handleSetup(
  req: Request,
  now = new Date(),
): Promise<Response> {
  const body = await parseBody(req, setupRequestSchema);
  if ("response" in body) return body.response;
  const { deviceId, label, proof, inviteCode } = body.data;

  const userId = randomUUID();
  const token = issueToken();
  try {
    const created = await createUserWithDevice(
      {
        userId,
        proofHash: hashToken(proof),
        deviceId,
        label,
        tokenHash: hashToken(token),
        now,
      },
      inviteCode ? hashInviteCode(inviteCode) : undefined,
    );
    if (!created) return errorResponse("invite_invalid", "Invalid invite");
  } catch (e) {
    const constraint = constraintOf(e);
    if (constraint === "users_single_uninvited") {
      return errorResponse("invite_required", "An invite is required");
    }
    if (constraint === "devices_pkey") {
      return errorResponse("device_exists", "Device already registered");
    }
    throw e;
  }
  return json({ userId, token } satisfies SetupResponse);
}
