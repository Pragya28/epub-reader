import { describe, expect, it } from "vitest";
import {
  DecryptionError,
  WrongKeyError,
  decryptArchive,
  encryptArchive,
  generateKey,
} from "../backup-encryption";
import { KeyCodeError, decodeKey, encodeKey } from "../encryption-key-code";

describe("backup encryption", () => {
  it.each([0, 1, 1000, 3_000_000])(
    "round-trips %i bytes byte-identically",
    async (size) => {
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i += 65_536) {
        crypto.getRandomValues(data.subarray(i, i + 65_536));
      }
      const key = generateKey();
      const out = await decryptArchive(await encryptArchive(data, key), key);
      expect(out).toEqual(data);
    },
  );

  it("fails distinctly with the wrong key", async () => {
    const envelope = await encryptArchive(
      new Uint8Array([1, 2, 3]),
      generateKey(),
    );
    await expect(
      decryptArchive(envelope, generateKey()),
    ).rejects.toBeInstanceOf(WrongKeyError);
  });

  // 8-byte payload: byte 0 is the version, 1-12 the IV, 13-20 the body, 21-36 the tag.
  it.each([
    ["IV", 5],
    ["body", 15],
    ["tag", 36],
  ])("rejects a flipped %s byte as a wrong-key failure", async (_, index) => {
    const key = generateKey();
    const envelope = await encryptArchive(new Uint8Array(8), key);
    expect(envelope.length).toBe(37);
    envelope[index] ^= 1;
    await expect(decryptArchive(envelope, key)).rejects.toBeInstanceOf(
      WrongKeyError,
    );
  });

  it("reports truncated and unknown-version input as non-key errors", async () => {
    const key = generateKey();
    const envelope = await encryptArchive(new Uint8Array([1]), key);
    const truncated = decryptArchive(envelope.slice(0, 10), key);
    await expect(truncated).rejects.toBeInstanceOf(DecryptionError);
    await expect(truncated).rejects.not.toBeInstanceOf(WrongKeyError);
    envelope[0] = 99;
    const unknown = decryptArchive(envelope, key);
    await expect(unknown).rejects.toBeInstanceOf(DecryptionError);
    await expect(unknown).rejects.not.toBeInstanceOf(WrongKeyError);
  });

  it("produces a different envelope each time for the same input", async () => {
    const key = generateKey();
    const data = new Uint8Array([1, 2, 3]);
    expect(await encryptArchive(data, key)).not.toEqual(
      await encryptArchive(data, key),
    );
  });
});

describe("encryption key code", () => {
  it("round-trips, ignoring case, spaces and dashes", async () => {
    const key = generateKey();
    const code = await encodeKey(key);
    expect(code).toMatch(/^([A-Z2-7]{4}-){13}[A-Z2-7]{4}$/);
    expect(await decodeKey(code)).toEqual(key);
    expect(await decodeKey(code.toLowerCase().replaceAll("-", " "))).toEqual(
      key,
    );
  });

  it("rejects a mistyped character via the checksum", async () => {
    const code = await encodeKey(generateKey());
    const typo = (code[0] === "A" ? "B" : "A") + code.slice(1);
    await expect(decodeKey(typo)).rejects.toBeInstanceOf(KeyCodeError);
  });

  it("decodes to a key that decrypts what the original key encrypted", async () => {
    const key = generateKey();
    const data = new Uint8Array([9, 8, 7]);
    const envelope = await encryptArchive(data, key);
    const restored = await decodeKey(await encodeKey(key));
    expect(await decryptArchive(envelope, restored)).toEqual(data);
  });

  it("rejects wrong length and invalid characters", async () => {
    await expect(decodeKey("ABCD-EFGH")).rejects.toBeInstanceOf(KeyCodeError);
    await expect(decodeKey("1".repeat(56))).rejects.toBeInstanceOf(
      KeyCodeError,
    );
  });
});
