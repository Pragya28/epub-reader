/**
 * Minimal in-memory fake of the OPFS API surface `opfs-files.ts` uses, for
 * tests that need to exercise the "OPFS is available" branch. jsdom itself
 * has no OPFS, so any test that doesn't stub it is automatically exercising
 * the "unsupported browser" fallback path instead (see book-files.test.ts).
 */

interface FakeWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FakeFileHandle {
  getFile(): Promise<Blob>;
  createWritable?(): Promise<FakeWritable>;
}

interface FakeDirectoryHandle {
  getFileHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<FakeFileHandle>;
  removeEntry(name: string): Promise<void>;
}

/** `supportsWrite: false` simulates a browser (Safari outside workers) where
 * `getDirectory()` exists but the returned handle has no `createWritable`. */
export function createFakeOpfsDirectory({
  supportsWrite = true,
}: { supportsWrite?: boolean } = {}): FakeDirectoryHandle {
  const files = new Map<string, Blob>();

  return {
    async getFileHandle(name, opts) {
      if (!files.has(name)) {
        if (!opts?.create) {
          throw new DOMException("File not found", "NotFoundError");
        }
        files.set(name, new Blob());
      }

      return {
        async getFile() {
          return files.get(name)!;
        },
        ...(supportsWrite
          ? {
              async createWritable(): Promise<FakeWritable> {
                const parts: BlobPart[] = [];
                return {
                  async write(data: Blob) {
                    parts.push(data);
                  },
                  async close() {
                    files.set(name, new Blob(parts));
                  },
                };
              },
            }
          : {}),
      };
    },
    async removeEntry(name) {
      if (!files.has(name)) {
        throw new DOMException("File not found", "NotFoundError");
      }
      files.delete(name);
    },
  };
}

/** Stubs `navigator.storage.getDirectory()` to resolve the given fake
 * directory (as the "epub-files" subdirectory). Pass `undefined` to
 * simulate a browser with no OPFS support at all. */
export function stubOpfs(dir: FakeDirectoryHandle | undefined) {
  Object.defineProperty(navigator, "storage", {
    value: dir
      ? {
          async getDirectory() {
            return {
              async getDirectoryHandle() {
                return dir;
              },
            };
          },
        }
      : undefined,
    configurable: true,
    writable: true,
  });
}
