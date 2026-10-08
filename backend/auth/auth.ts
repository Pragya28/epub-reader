import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  DEVICE_IDLE_EXPIRY_MS,
  TOKEN_ROTATION_MS,
} from "../../contracts/auth-constants.js";
import {
  bumpDeviceActivity,
  getDevice,
  rotateDeviceToken,
  touchDevice,
} from "../db/db.js";

export type AuthErrorCode = "invalid_credentials" | "token_expired";

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface AuthResult {
  userId: string;
  // Present only when this call rotated the device's token.
  token?: string;
}

export function issueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sameHash(a: string, b: string | null): boolean {
  return (
    b !== null &&
    a.length === b.length &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}

// Checks a device's token (D5, D7-D9), bumps its activity and rotates the token
// when due. `now` is injected so tests never sleep.
export async function authenticate(
  deviceId: string,
  token: string,
  now: Date,
): Promise<AuthResult> {
  const device = await getDevice(deviceId);
  const hash = hashToken(token);
  const isCurrent = !!device && sameHash(hash, device.token_hash);
  const isPrevious = !!device && sameHash(hash, device.prev_token_hash);
  if (!device || (!isCurrent && !isPrevious)) {
    throw new AuthError("invalid_credentials");
  }
  if (now.getTime() - device.last_seen_at.getTime() > DEVICE_IDLE_EXPIRY_MS) {
    throw new AuthError("token_expired");
  }

  // A previous-token retry always gets a fresh token: the current one's plaintext
  // is not stored, and the device never received it.
  const due =
    isPrevious ||
    now.getTime() - device.token_rotated_at.getTime() > TOKEN_ROTATION_MS;
  if (due) {
    const next = issueToken();
    if (
      await rotateDeviceToken(deviceId, device.token_hash, hashToken(next), now)
    ) {
      return { userId: device.user_id, token: next };
    }
    // Another request rotated first; this caller's token was valid when it arrived.
    await bumpDeviceActivity(deviceId, now);
    return { userId: device.user_id };
  }

  await touchDevice(deviceId, now);
  return { userId: device.user_id };
}
