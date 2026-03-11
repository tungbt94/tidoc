#!/usr/bin/env node

import { resolve } from "node:path";
import { createServer } from "./server.js";

function printHelp() {
  console.log(`tidoc — serve Markdown files as a documentation site

Usage:
  tidoc serve [path] [--port <number>] [--ignore <pattern>]

Commands:
  serve [path]    Start the documentation server.
                  [path] defaults to the current working directory.

Options:
  --port <number>    Port to listen on (default: 4000)
  --ignore <pattern> Glob pattern to ignore (can be specified multiple times)
  --help, -h         Show this help message
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
    } else if (!args[i].startsWith("-")) {
      rootPath = args[i];
    } else {
      console.error(`Unknown option: ${args[i]}\n`);
      printHelp();
      process.exit(1);
    }
  }

  rootPath = resolve(rootPath);

  const options = {};
  if (ignore.length > 0) {
    options.ignore = ignore;
  }

  const { app, start } = await createServer(rootPath, options);
  await start(port);
}
