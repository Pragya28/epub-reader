import { randomBytes } from "node:crypto";

import { hashToken } from "./auth.js";

// Codes are shown in groups of four ("ABCD-EFGH-..."); users may type them any way.
export function hashInviteCode(code: string): string {
  return hashToken(code.replace(/[\s-]/g, "").toUpperCase());
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// 80 random bits as 16 base32 characters, in groups of four.
export function generateInviteCode(): string {
  let bits = "";
  for (const byte of randomBytes(10)) bits += byte.toString(2).padStart(8, "0");
  const chars = bits.match(/.{5}/g)!.map((b) => BASE32[parseInt(b, 2)]);
  return chars.join("").match(/.{4}/g)!.join("-");
}
