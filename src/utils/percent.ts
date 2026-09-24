/**
 * Clamps a reading-progress percent to the valid 0-100 range, and maps
 * NaN/Infinity to 0. `computeReaderProgress` (save-reader-progress.ts)
 * already clamps every value it computes going forward, but a value read
 * back from storage — persisted before that clamp existed, or carried in
 * from a backup/import — isn't guaranteed to be in range. Both consumers
 * of a stored `percent` (the reader's progress bar seed, the library
 * card's status/percent display) should run it through this before
 * trusting it, so a corrupted stored value (e.g. "3090%") can't render.
 */
export function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Computes `numerator / denominator` as a 0-100 percent, always run
 * through `clampPercent` — the one place both the math and the safety net
 * live, so no caller can compute a raw ratio and forget to clamp it (how
 * the "3090%" bug happened: the clamp existed, but not every call site
 * that turned a ratio into a percent used it).
 *
 * @param decimals Rounds to this many decimal places before clamping (e.g.
 * reading progress rounds to 1). Omit to keep the raw float (e.g. storage
 * usage, which is only ever displayed via a formatter).
 *
 * A zero/negative denominator, like any other non-finite result, comes
 * back 0 rather than throwing or producing NaN/Infinity.
 */
export function toPercent(
  numerator: number,
  denominator: number,
  decimals?: number,
): number {
  const raw = (numerator / denominator) * 100;
  return clampPercent(
    decimals === undefined ? raw : roundToDecimals(raw, decimals),
  );
}
