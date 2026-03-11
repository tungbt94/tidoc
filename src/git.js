import { execFile, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Check if a string looks like a git URL or GitHub shorthand.
 * @param {string} input
 * @returns {boolean}
 */
export function isGitUrl(input) {
  if (
    input.startsWith("https://") ||
    input.startsWith("http://") ||
    input.startsWith("git://") ||
    input.startsWith("git@")
  ) {
    return true;
  }
  // GitHub shorthand: user/repo — must not start with . or / or ~
  if (/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*\/[a-zA-Z0-9_.-]+$/.test(input)) {
    return true;
  }
  return false;
}

/**
 * Normalize a git URL. Expands GitHub shorthand to full URL.
 * @param {string} input
 * @returns {string}
 */
export function normalizeGitUrl(input) {
  // GitHub shorthand
  if (/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*\/[a-zA-Z0-9_.-]+$/.test(input)) {
    return `https://github.com/${input}.git`;
  }
  return input;
}

/**
 * Try to build a tarball URL for known git hosts.
 * Returns { tarballUrl, displayName } or null.
 * @param {string} url
 * @param {string} [branch]
 * @returns {{ tarballUrl: string, displayName: string } | null}
 */
function getTarballInfo(url, branch) {
  // GitHub: https://github.com/owner/repo
  const gh = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (gh) {
    const ref = branch || "";
    return {
      tarballUrl: `https://api.github.com/repos/${gh[1]}/${gh[2]}/tarball/${ref}`,
      displayName: `${gh[1]}/${gh[2]}${branch ? `@${branch}` : ""}`,
    };
  }

  // GitLab: https://gitlab.com/owner/repo
  const gl = url.match(/gitlab\.com[/:]([^/]+)\/([^/.]+)/);
  if (gl) {
    const ref = branch || "HEAD";
    return {
      tarballUrl: `https://gitlab.com/${gl[1]}/${gl[2]}/-/archive/${ref}/${gl[2]}-${ref}.tar.gz`,
      displayName: `${gl[1]}/${gl[2]}${branch ? `@${branch}` : ""}`,
    };
  }

  // Bitbucket: https://bitbucket.org/owner/repo
  const bb = url.match(/bitbucket\.org[/:]([^/]+)\/([^/.]+)/);
  if (bb) {
    const ref = branch || "HEAD";
    return {
      tarballUrl: `https://bitbucket.org/${bb[1]}/${bb[2]}/get/${ref}.tar.gz`,
      displayName: `${bb[1]}/${bb[2]}${branch ? `@${branch}` : ""}`,
    };
  }

  return null;
}

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format milliseconds into a human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Follow redirects and download a URL via Node.js https, piping to tar.
 * Shows download progress (size, speed) in real time.
 *
 * @param {string} url
 * @param {string} tmpDir
 * @param {number} [maxRedirects=5]
 * @returns {Promise<void>}
 */
function downloadAndExtract(url, tmpDir, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));

    const req = https.get(url, { headers: { "User-Agent": "tidoc", "Accept": "application/octet-stream, application/vnd.github+json" } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return downloadAndExtract(res.headers.location, tmpDir, maxRedirects - 1).then(resolve, reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers["content-length"], 10) || 0;
      let downloaded = 0;
      const startTime = Date.now();
      let lastLog = 0;

      res.on("data", (chunk) => {
        downloaded += chunk.length;
        const now = Date.now();
        // Log progress every 200ms
        if (now - lastLog >= 200) {
          lastLog = now;
          const elapsed = (now - startTime) / 1000 || 0.1;
          const speed = formatBytes(downloaded / elapsed) + "/s";
          const progress = totalBytes
            ? ` ${Math.round((downloaded / totalBytes) * 100)}%`
            : "";
          process.stdout.write(`\r  Downloading: ${formatBytes(downloaded)}${progress} (${speed})`);
        }
      });

      // Pipe response to tar for extraction
      const tar = spawn("tar", ["xz", "-C", tmpDir, "--strip-components=1"], { stdio: ["pipe", "ignore", "pipe"] });

      let tarErr = "";
      tar.stderr.on("data", (d) => { tarErr += d; });

      res.pipe(tar.stdin);

      tar.on("close", (code) => {
        const elapsed = Date.now() - startTime;
        const speed = formatBytes(downloaded / (elapsed / 1000 || 0.1)) + "/s";
        process.stdout.write(`\r  Downloaded: ${formatBytes(downloaded)} in ${formatDuration(elapsed)} (${speed})    \n`);
        if (code !== 0) return reject(new Error(`tar failed: ${tarErr}`));
        resolve();
      });

      tar.on("error", reject);
      res.on("error", reject);
    });

    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(new Error("Timeout")); });
  });
}

/**
 * Download a repo as a tarball. Works with GitHub, GitLab, Bitbucket.
 *
 * @param {string} tarballUrl
 * @param {string} displayName
 * @returns {Promise<string>} Path to the extracted directory
 */
async function downloadTarball(tarballUrl, displayName) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "tidoc-"));

  console.log(`Downloading ${displayName}...`);

  try {
    await downloadAndExtract(tarballUrl, tmpDir);
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  return tmpDir;
}

/**
 * Git clone fallback with progress.
 */
async function gitClone(gitUrl, options = {}) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "tidoc-"));
  const startTime = Date.now();

  console.log(`Cloning ${gitUrl}...`);

  try {
    const args = ["clone", "--depth", "1", "--single-branch", "--no-tags", "--progress"];
    if (options.branch) {
      args.push("--branch", options.branch);
    }
    args.push(gitUrl, tmpDir);
    const proc = spawn("git", args, { stdio: ["ignore", "ignore", "pipe"] });
    proc.stderr.on("data", (d) => {
      const line = d.toString().trim();
      if (line) process.stderr.write(`\r  ${line}`);
    });
    await new Promise((resolve, reject) => {
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`git clone failed (exit ${code})`)));
      proc.on("error", reject);
    });
    process.stderr.write("\n");
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Failed to clone: ${err.message}`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`Cloned in ${formatDuration(elapsed)}`);
  return tmpDir;
}

/**
 * Download a repo. Tries tarball first (fastest), falls back to git clone.
 * Supports GitHub, GitLab, Bitbucket tarballs.
 *
 * @param {string} url - Git URL or GitHub shorthand
 * @param {{ branch?: string, subdir?: string }} options
 * @returns {Promise<string>} Path to the downloaded directory
 */
export async function cloneRepo(url, options = {}) {
  const gitUrl = normalizeGitUrl(url);

  // Try tarball first (GitHub, GitLab, Bitbucket)
  const tarball = getTarballInfo(gitUrl, options.branch);
  if (tarball) {
    try {
      const tmpDir = await downloadTarball(tarball.tarballUrl, tarball.displayName);
      return tmpDir;
    } catch {
      console.log(`Tarball failed, falling back to git clone...`);
    }
  }

  // Fallback: git clone
  return gitClone(gitUrl, options);
}

/**
 * Register cleanup handlers to remove a temp directory on process exit.
 * @param {string} tmpDir
 */
export function registerCleanup(tmpDir) {
  const asyncCleanup = async () => {
    console.log("\nCleaning up temp directory...");
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", asyncCleanup);
  process.on("SIGTERM", asyncCleanup);
  process.on("exit", () => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });
}
