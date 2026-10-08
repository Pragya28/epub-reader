import type { ZodType } from "zod";

import { AuthError, authenticate, type AuthResult } from "../auth/auth.js";

import { DEVICE_ID_HEADER } from "../../contracts/authenticated.js";
import { ERROR_STATUS, type ErrorCode } from "../../contracts/errors.js";

export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(code: ErrorCode, message: string): Response {
  return json({ error: { code, message } }, ERROR_STATUS[code]);
}

// Parsed body, or the `invalid_request` response to return as-is.
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { response: Response }> {
  const parsed = schema.safeParse(await req.json().catch(() => undefined));
  return parsed.success
    ? { data: parsed.data }
    : { response: errorResponse("invalid_request", "Invalid request body") };
}

export function constraintOf(e: unknown): string | undefined {
  return (e as { constraint?: string }).constraint;
}

// Authenticated caller from the D9 headers, or the response to return as-is.
export async function authenticateRequest(
  req: Request,
  now: Date,
): Promise<{ auth: AuthResult } | { response: Response }> {
  const deviceId = req.headers.get(DEVICE_ID_HEADER);
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!deviceId || !token) {
    return {
      response: errorResponse("invalid_credentials", "Missing credentials"),
    };
  }
  try {
    return { auth: await authenticate(deviceId, token, now) };
  } catch (e) {
    if (e instanceof AuthError) {
      return { response: errorResponse(e.code, e.code) };
    }
    throw e;
  }
}
