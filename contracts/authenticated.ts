import { z } from "zod";

export const DEVICE_ID_HEADER = "X-Device-Id";

// Every authenticated response extends this; `token` is present only when the
// call rotated the device's token, and the client saves it before anything else.
export const authenticatedResponseSchema = z.object({
  token: z.string().optional(),
});

export const deviceIdSchema = z.string().min(1).max(128);
export const labelSchema = z.string().min(1).max(100);
export const proofSchema = z.string().min(1).max(256);
