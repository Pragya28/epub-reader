import { z } from "zod";

export const recoverResponseSchema = z.object({ token: z.string() });
export type RecoverResponse = z.infer<typeof recoverResponseSchema>;
