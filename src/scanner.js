import path from "node:path";
import { glob } from "glob";

/**
 * Scan a directory for all .md files recursively.
 * @param {string} rootPath - The root directory to scan.
 * @param {object} [options={}] - Optional settings.
 * @param {string[]} [options.ignore] - Additional glob patterns to ignore.
 * @returns {Promise<Array<{path: string, relativePath: string, name: string}>>}
 */
export async function scanFiles(rootPath, options = {}) {
  const absoluteRoot = path.resolve(rootPath);

  const defaultIgnore = [
    // Version control
    ".git/**",
    ".svn/**",
    ".hg/**",
    // Node.js
    "node_modules/**",
    // Python
    "venv/**",
    ".venv/**",
    "__pycache__/**",
    ".pytest_cache/**",
    ".mypy_cache/**",
    ".tox/**",
    // Ruby
    "vendor/bundle/**",
    // PHP / Go
    "vendor/**",
    // Rust / Java / Scala
    "target/**",
    // Java / Kotlin
    ".gradle/**",
    // .NET
    "bin/**",
    "obj/**",
    "packages/**",
    // Elixir
    "_build/**",
    "deps/**",
    // Build outputs
    "dist/**",
    "build/**",
    "out/**",
    // Misc
    ".tidoc/**",
    ".cache/**",
    "coverage/**",
    ".next/**",
    ".nuxt/**",
    ".output/**",
    ".turbo/**",
  ];
  const ignore = options.ignore
    ? [...defaultIgnore, ...options.ignore]
    : defaultIgnore;

  const files = await glob("**/*.md", {
    cwd: absoluteRoot,
    ignore,
  });

  return files
    .sort((a, b) => {
      const dirA = path.dirname(a);
      const dirB = path.dirname(b);

      // If both files are in the same directory, sort README.md first
      if (dirA === dirB) {
        const baseA = path.basename(a);
        const baseB = path.basename(b);
        const aIsReadme = baseA.toLowerCase() === "readme.md";
        const bIsReadme = baseB.toLowerCase() === "readme.md";
        if (aIsReadme && !bIsReadme) return -1;
        if (!aIsReadme && bIsReadme) return 1;
        return a.localeCompare(b);
      }

      // Otherwise sort alphabetically by full relative path
      return a.localeCompare(b);
    })
    .map((relativePath) => ({
      path: path.join(absoluteRoot, relativePath),
      relativePath,
      name: path.basename(relativePath, ".md"),
    }));
}
