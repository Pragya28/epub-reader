import { hashToken } from "./auth";

// Codes are shown in groups of four ("ABCD-EFGH-..."); users may type them any way.
export function hashInviteCode(code: string): string {
  return hashToken(code.replace(/[\s-]/g, "").toUpperCase());
}
