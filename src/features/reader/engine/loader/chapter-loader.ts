export interface ChapterLoadPlan {
  /** Chapter indices that should be mounted in the iframe DOM. */
  toLoad: number[];
  /** Currently-loaded indices that fall outside the window and should be unmounted. */
  toUnload: number[];
}

export class ChapterLoader {
  /**
   * Number of chapters to keep mounted on each side of the currently
   * visible chapter (mirrors WINDOW_RADIUS from the POC).
   */
  private readonly windowRadius: number;

  constructor(windowRadius: number = 2) {
    this.windowRadius = windowRadius;
  }

  /**
   * Given the current reading position, total chapter count, and the
   * set of currently-loaded indices, decide which indices should be
   * loaded (mounted) and which should be unloaded.
   *
   * Pure/DOM-free by design — no iframe, no rendering, no async — so
   * it's cheap to unit test in isolation from the rendering engine.
   */
  getLoadPlan(
    currentIndex: number,
    totalChapters: number,
    loadedIndices: ReadonlySet<number>,
  ): ChapterLoadPlan {
    if (totalChapters <= 0) {
      return { toLoad: [], toUnload: [...loadedIndices] };
    }

    const windowIndices = this.getWindowIndices(currentIndex, totalChapters);

    const toLoad = [...windowIndices].filter((i) => !loadedIndices.has(i));
    const toUnload = [...loadedIndices].filter((i) => !windowIndices.has(i));

    return { toLoad, toUnload };
  }

  hasNextChapter(index: number, totalChapters: number): boolean {
    return index + 1 < totalChapters;
  }

  hasPreviousChapter(index: number): boolean {
    return index - 1 >= 0;
  }

  private getWindowIndices(
    currentIndex: number,
    totalChapters: number,
  ): Set<number> {
    const clampedCurrent = this.clamp(currentIndex, 0, totalChapters - 1);

    const start = this.clamp(
      clampedCurrent - this.windowRadius,
      0,
      totalChapters - 1,
    );
    const end = this.clamp(
      clampedCurrent + this.windowRadius,
      0,
      totalChapters - 1,
    );

    const indices = new Set<number>();
    for (let i = start; i <= end; i++) {
      indices.add(i);
    }

    return indices;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
