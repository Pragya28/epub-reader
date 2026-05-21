import fs from "node:fs/promises";

export async function loadFixture(filename: string): Promise<File> {
  const path = `src/tests/fixtures/${filename}`;

  const buffer = await fs.readFile(path);

  return new File([buffer], filename, {
    type: "application/epub+zip",
  });
}
