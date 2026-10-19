// Envelope: [version: 1 byte][iv: 12 bytes][AES-GCM ciphertext + tag].
const VERSION = 1;
const IV_BYTES = 12;
const HEADER_BYTES = 1 + IV_BYTES;
const GCM_TAG_BYTES = 16;

export const KEY_BYTES = 32;

export class DecryptionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DecryptionError";
  }
}

// Wrong key or tampered data: the GCM tag did not verify.
export class WrongKeyError extends DecryptionError {
  constructor(options?: ErrorOptions) {
    super("Couldn't decrypt: wrong key or corrupted data.", options);
    this.name = "WrongKeyError";
  }
}

export function generateKey(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}

function importKey(key: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptArchive(
  data: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await importKey(key),
    data,
  );
  const out = new Uint8Array(HEADER_BYTES + cipher.byteLength);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(new Uint8Array(cipher), HEADER_BYTES);
  return out;
}

export async function decryptArchive(
  envelope: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  if (envelope.length < HEADER_BYTES + GCM_TAG_BYTES) {
    throw new DecryptionError("Encrypted archive is truncated.");
  }
  if (envelope[0] !== VERSION) {
    throw new DecryptionError("Unsupported encrypted archive version.");
  }
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: envelope.slice(1, HEADER_BYTES) },
      await importKey(key),
      envelope.slice(HEADER_BYTES),
    );
    return new Uint8Array(plain);
  } catch (cause) {
    throw new WrongKeyError({ cause });
  }
}
