import { KEY_BYTES } from "./backup-encryption";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const KEY_CHARS = Math.ceil((KEY_BYTES * 8) / 5); // 52; the last char carries 4 padding bits
const CHECK_CHARS = 4;
const CODE_CHARS = KEY_CHARS + CHECK_CHARS;

export class KeyCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyCodeError";
  }
}

function toBase32(bytes: Uint8Array<ArrayBuffer>): string {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  return bits
    .padEnd(Math.ceil(bits.length / 5) * 5, "0")
    .match(/.{5}/g)!
    .map((b) => BASE32[parseInt(b, 2)])
    .join("");
}

function fromBase32(chars: string): Uint8Array<ArrayBuffer> {
  const bits = [...chars]
    .map((c) => BASE32.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes = bits.match(/.{8}/g)!.map((b) => parseInt(b, 2));
  return new Uint8Array(bytes.slice(0, KEY_BYTES));
}

// Checksum group: the first 20 bits of SHA-256(key), so a mistyped code is caught before use.
async function checksum(key: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", key));
  return toBase32(hash.slice(0, 3)).slice(0, CHECK_CHARS);
}

// "ABCD-EFGH-..." — 52 key characters plus a 4-character checksum, in groups of four.
export async function encodeKey(key: Uint8Array<ArrayBuffer>): Promise<string> {
  return (toBase32(key) + (await checksum(key))).match(/.{4}/g)!.join("-");
}

export async function decodeKey(
  code: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const chars = code.replace(/[\s-]/g, "").toUpperCase();
  if (
    chars.length !== CODE_CHARS ||
    ![...chars].every((c) => BASE32.includes(c))
  ) {
    throw new KeyCodeError("That isn't a valid key.");
  }
  const key = fromBase32(chars.slice(0, KEY_CHARS));
  if (chars.slice(KEY_CHARS) !== (await checksum(key))) {
    throw new KeyCodeError("That key has a typo. Check it and try again.");
  }
  return key;
}
