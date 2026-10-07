import { DEVICE_IDLE_EXPIRY_MS } from "../../contracts/auth-constants";
import { DEVICE_ID_HEADER } from "../../contracts/authenticated";
import type { RecoverResponse } from "../../contracts/recover";
import { hashToken, issueToken, sameHash } from "../auth/auth";
import { getDevice, rotateDeviceToken } from "../db/db";
import { errorResponse, json } from "./http";

// Re-issues a token to a device that idled out (D10). `authenticate()` can't be
// reused: it rejects an expired device, and here that is the required state.
export async function handleRecover(
  req: Request,
  now = new Date(),
): Promise<Response> {
  const deviceId = req.headers.get(DEVICE_ID_HEADER);
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  const device = deviceId ? await getDevice(deviceId) : undefined;
  if (!device || !token || !sameHash(hashToken(token), device.token_hash)) {
    return errorResponse("invalid_credentials", "Invalid credentials");
  }
  if (now.getTime() - device.last_seen_at.getTime() <= DEVICE_IDLE_EXPIRY_MS) {
    return errorResponse("not_expired", "Device is not expired");
  }

  const next = issueToken();
  // A racing recover already replaced the token this caller proved.
  if (
    !(await rotateDeviceToken(
      device.device_id,
      device.token_hash,
      hashToken(next),
      now,
    ))
  ) {
    return errorResponse("invalid_credentials", "Invalid credentials");
  }
  return json({ token: next } satisfies RecoverResponse);
}
