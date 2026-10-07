import type { ZodType } from "zod";

import { ERROR_STATUS, type ErrorCode } from "../../contracts/errors";

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
