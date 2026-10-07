import { z } from "zod";

import { deviceIdSchema, labelSchema, proofSchema } from "./authenticated.ts";

export const registerRequestSchema = z.object({
  userId: z.uuid(),
  deviceId: deviceIdSchema,
  label: labelSchema,
  proof: proofSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const registerResponseSchema = z.object({ token: z.string() });
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
