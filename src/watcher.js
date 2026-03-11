import path from "node:path";
import { watch } from "chokidar";

/**
 * Create a file watcher for .md files under a root directory.
 * @param {string} rootPath - The root directory to watch.
 * @param {(eventType: "add" | "change" | "unlink", relativePath: string) => void} onChange - Callback fired on file changes.
 * @returns {import("chokidar").FSWatcher} The chokidar watcher instance.
 */
export function createWatcher(rootPath, onChange) {
  const absoluteRoot = path.resolve(rootPath);

  const watcher = watch("**/*.md", {
    cwd: absoluteRoot,
    ignoreInitial: true,
    ignored: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.tidoc/**",
      "**/dist/**",
      "**/build/**",
    ],
  });

  for (const eventType of ["add", "change", "unlink"]) {
    watcher.on(eventType, (filePath) => {
      const relativePath = path.relative(absoluteRoot, path.resolve(absoluteRoot, filePath));
      onChange(eventType, relativePath);
    });
  }

  return watcher;
}
