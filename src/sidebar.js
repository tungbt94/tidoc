import path from "node:path";

/**
 * Build a sidebar tree from a flat list of scanned file objects.
 *
 * @param {Array<{path: string, relativePath: string, name: string}>} files
 * @returns {Array<{name: string, path: string, type: "file"} | {name: string, type: "directory", children: Array}>}
 */
export function buildSidebar(files) {
  // Intermediate map: directory path -> array of file entries
  const dirMap = new Map();

  for (const file of files) {
    const dir = path.dirname(file.relativePath);
    const dirKey = dir === "." ? "" : dir;

    if (!dirMap.has(dirKey)) {
      dirMap.set(dirKey, []);
    }

    dirMap.get(dirKey).push({
      name: file.name,
      path: file.relativePath,
      type: "file",
    });
  }

  // Sort files within each directory: README first, then alphabetical by name
  for (const entries of dirMap.values()) {
    entries.sort((a, b) => {
      const aIsReadme = a.name.toLowerCase() === "readme";
      const bIsReadme = b.name.toLowerCase() === "readme";
      if (aIsReadme && !bIsReadme) return -1;
      if (!aIsReadme && bIsReadme) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // Build directory nodes recursively from the map.
  // We only create directory nodes for directories that have files (directly or nested).
  const buildLevel = (prefix) => {
    const result = [];

    // Collect immediate subdirectory names at this level
    const subdirs = new Set();
    for (const dirKey of dirMap.keys()) {
      if (dirKey === prefix) continue;

      const relative = prefix === "" ? dirKey : dirKey.startsWith(prefix + "/") ? dirKey.slice(prefix.length + 1) : null;

      if (relative === null) continue;

      // Only take the immediate child directory name
      const firstSegment = relative.split("/")[0];
      if (firstSegment) {
        subdirs.add(firstSegment);
      }
    }

    // Add directory nodes sorted alphabetically
    const sortedDirs = [...subdirs].sort((a, b) => a.localeCompare(b));
    for (const dirName of sortedDirs) {
      const childPrefix = prefix === "" ? dirName : `${prefix}/${dirName}`;
      const children = buildLevel(childPrefix);
      if (children.length > 0) {
        result.push({
          name: dirName,
          type: "directory",
          children,
        });
      }
    }

    // Add file nodes at this level
    const filesAtLevel = dirMap.get(prefix) || [];
    // Interleave: files with README first, then alphabetical — already sorted above

    // Final combined result: directories first (sorted), then files (sorted with README first)
    // Actually, re-reading the requirements: files at root listed directly, files in subdirs grouped.
    // The example shows files and directories mixed. Let's put directories sorted among files,
    // but with the convention: README first, then directories and other files alphabetically.
    const combined = [];
    const readmeFiles = filesAtLevel.filter((f) => f.name.toLowerCase() === "readme");
    const nonReadmeFiles = filesAtLevel.filter((f) => f.name.toLowerCase() !== "readme");

    // README always first
    combined.push(...readmeFiles);

    // Merge directories and non-readme files alphabetically
    let fi = 0;
    let di = 0;
    while (fi < nonReadmeFiles.length && di < sortedDirs.length) {
      const dirNode = result[di];
      if (nonReadmeFiles[fi].name.localeCompare(sortedDirs[di]) <= 0) {
        combined.push(nonReadmeFiles[fi]);
        fi++;
      } else {
        combined.push(dirNode);
        di++;
      }
    }
    while (fi < nonReadmeFiles.length) {
      combined.push(nonReadmeFiles[fi]);
      fi++;
    }
    while (di < sortedDirs.length) {
      combined.push(result[di]);
      di++;
    }

    return combined;
  };

  return buildLevel("");
}
