import { INVITE_EXPIRY_MS } from "../../contracts/auth-constants";
import type { InvitesResponse } from "../../contracts/invites";
import { generateInviteCode, hashInviteCode } from "../auth/invite-code";
import { insertInvite } from "../db/db";
import { authenticateRequest, json } from "./http";

export async function handleInvites(
  req: Request,
  now = new Date(),
): Promise<Response> {
  const result = await authenticateRequest(req, now);
  if ("response" in result) return result.response;

  const code = generateInviteCode();
  const invite = await insertInvite({
    code_hash: hashInviteCode(code),
    created_by: result.auth.userId,
    created_at: now,
    expires_at: new Date(now.getTime() + INVITE_EXPIRY_MS),
  });
  return json({
    code,
    expiresAt: invite.expires_at.toISOString(),
    ...(result.auth.token && { token: result.auth.token }),
  } satisfies InvitesResponse);
}
