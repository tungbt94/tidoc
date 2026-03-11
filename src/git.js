import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
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
 * Shallow clone a git repo into a temp directory.
 * @param {string} url - Git URL or GitHub shorthand
 * @param {{ branch?: string }} options
 * @returns {Promise<string>} Path to the cloned directory
 */
export async function cloneRepo(url, options = {}) {
  const gitUrl = normalizeGitUrl(url);
  const tmpDir = await mkdtemp(path.join(tmpdir(), "tidoc-"));

  const args = ["clone", "--depth", "1"];
  if (options.branch) {
    args.push("--branch", options.branch);
  }
  args.push(gitUrl, tmpDir);

  console.log(`Cloning ${gitUrl}...`);

  try {
    await execFileAsync("git", args, { timeout: 60000 });
  } catch (err) {
    // Cleanup on failure
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Failed to clone: ${err.stderr || err.message}`);
  }

  console.log(`Cloned to ${tmpDir}`);
  return tmpDir;
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
