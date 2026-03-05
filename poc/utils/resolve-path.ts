export function resolvePath(basePath: string, relativePath: string) {
  return new URL(relativePath, "http://dummy/" + basePath).pathname.substring(
    1,
  );
}
