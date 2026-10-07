import { z } from "zod";

export const ERROR_STATUS = {
  invalid_request: 400,
  invite_required: 409,
  invite_invalid: 401,
  registration_rejected: 401,
  device_exists: 409,
  token_expired: 401,
  invalid_credentials: 401,
  not_expired: 409,
  server_error: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
