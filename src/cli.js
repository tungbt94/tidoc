#!/usr/bin/env node

import path from "node:path";
import { createServer } from "./server.js";
import { isGitUrl, cloneRepo, registerCleanup } from "./git.js";

function printHelp() {
  console.log(`tidoc — serve Markdown files as a documentation site

Usage:
  tidoc serve [path|url] [options]

Commands:
  serve [path]       Start the documentation server.
                     [path] defaults to the current working directory.
  serve <url>        Clone a git repo and serve its docs.
                     Supports https://, git://, or GitHub shorthand (user/repo).

Options:
  --port <number>    Port to listen on (default: 4000)
  --ignore <pattern> Glob pattern to ignore (can be specified multiple times)
  --branch <name>    Git branch to clone (default: repo default branch)
  --subdir <path>    Subdirectory within repo to serve (default: repo root)
  --help, -h         Show this help message

Examples:
  tidoc serve
  tidoc serve ./docs --port 3000
  tidoc serve https://github.com/user/repo
  tidoc serve user/repo --branch main --subdir docs
`);
}

export async function run(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(argv.includes("--help") || argv.includes("-h") ? 0 : 1);
  }

  const command = argv[0];

  if (command !== "serve") {
    console.error(`Unknown command: ${command}\n`);
    printHelp();
    process.exit(1);
  }

  // Parse remaining args after "serve"
  const args = argv.slice(1);
  let rootPath = process.cwd();
  let port = 4000;
  let branch = undefined;
  let subdir = undefined;
  const ignore = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port") {
      const value = args[++i];
      port = Number(value);
      if (!Number.isInteger(port) || port <= 0) {
        console.error(`Invalid port: ${value}`);
        process.exit(1);
      }
    } else if (args[i] === "--ignore") {
      const pattern = args[++i];
      if (!pattern) {
        console.error("Missing value for --ignore");
        process.exit(1);
      }
      ignore.push(pattern);
    } else if (args[i] === "--branch") {
      branch = args[++i];
      if (!branch) {
        console.error("Missing value for --branch");
        process.exit(1);
      }
    } else if (args[i] === "--subdir") {
      subdir = args[++i];
      if (!subdir) {
        console.error("Missing value for --subdir");
        process.exit(1);
      }
    } else if (!args[i].startsWith("-")) {
      rootPath = args[i];
    } else {
      console.error(`Unknown option: ${args[i]}\n`);
      printHelp();
      process.exit(1);
    }
  }

  // If path looks like a git URL, clone it first
  if (isGitUrl(rootPath)) {
    const tmpDir = await cloneRepo(rootPath, { branch, subdir });
    registerCleanup(tmpDir);
    rootPath = subdir ? path.join(tmpDir, subdir) : tmpDir;
  } else {
    rootPath = path.resolve(rootPath);
  }

  const options = {};
  if (ignore.length > 0) {
    options.ignore = ignore;
  }

  const { start } = await createServer(rootPath, options);
  await start(port);
}
