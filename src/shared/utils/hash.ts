export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hashString(str: string): number {
  let hash = 0x811c9dc5; // offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i); // XOR in next byte/character
    hash = Math.imul(hash, 0x01000193); // Multiply by FNV prime
  }

  return hash >>> 0; // Convert to unsigned 32-bit integer
}
