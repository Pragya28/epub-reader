import { z } from "zod";

import { authenticatedResponseSchema } from "./authenticated.ts";

export const invitesResponseSchema = authenticatedResponseSchema.extend({
  code: z.string(),
  expiresAt: z.iso.datetime(),
});
export type InvitesResponse = z.infer<typeof invitesResponseSchema>;
