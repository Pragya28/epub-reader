import { z } from "zod";

import { deviceIdSchema, labelSchema, proofSchema } from "./authenticated.ts";

export const setupRequestSchema = z.object({
  deviceId: deviceIdSchema,
  label: labelSchema,
  proof: proofSchema,
  inviteCode: z.string().min(1).max(64).optional(),
});
export type SetupRequest = z.infer<typeof setupRequestSchema>;

export const setupResponseSchema = z.object({
  userId: z.uuid(),
  token: z.string(),
});
export type SetupResponse = z.infer<typeof setupResponseSchema>;
