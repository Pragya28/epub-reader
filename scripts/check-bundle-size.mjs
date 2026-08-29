#!/usr/bin/env node
// Bundle-size regression guard. Runs after `vite build` (wired into the
// `build` script), so the existing pre-push hook enforces it.
//
// Not a tight budget — a generous ceiling, like the *.perf.test.ts files.
// It exists to catch a chunk silently doubling (a stray eager import of the
// reader engine / JSZip, a fat new dependency), not to police every kB.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

// Largest single JS chunk, gzipped. Entry chunk is ~231 kB gzip as of the
// Sprint 8 Day 3 split; this is ~1.35x headroom.
const MAX_CHUNK_GZIP_KB = 310;

const assetsDir = join(process.cwd(), "dist", "assets");

let files;
try {
  files = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`check-bundle-size: ${assetsDir} not found — run \`vite build\` first.`);
  process.exit(1);
}

const chunks = files
  .map((f) => {
    const path = join(assetsDir, f);
    return { f, raw: statSync(path).size, gzip: gzipSync(readFileSync(path)).length };
  })
  .sort((a, b) => b.gzip - a.gzip);

const kb = (n) => (n / 1024).toFixed(2);
for (const c of chunks) {
  console.log(`  ${c.f}  ${kb(c.raw)} kB  (gzip ${kb(c.gzip)} kB)`);
}

const biggest = chunks[0];
if (biggest.gzip / 1024 > MAX_CHUNK_GZIP_KB) {
  console.error(
    `\ncheck-bundle-size: FAIL — ${biggest.f} is ${kb(biggest.gzip)} kB gzip, ` +
      `over the ${MAX_CHUNK_GZIP_KB} kB budget.\n` +
      `Split it with a dynamic import(), or if the growth is justified, ` +
      `bump MAX_CHUNK_GZIP_KB in scripts/check-bundle-size.mjs.`,
  );
  process.exit(1);
}

console.log(`\ncheck-bundle-size: OK — largest chunk ${kb(biggest.gzip)} kB gzip (budget ${MAX_CHUNK_GZIP_KB} kB).`);
