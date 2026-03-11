# Tidoc

CLI tool that scans all .md files in a project and serves them as a documentation website.

## Tech Stack
- Runtime: Node.js (ESM)
- Server: Hono
- Markdown parser: marked
- File watcher: chokidar
- File scanner: glob
- Frontend: Vanilla JS + Pico.css + Fuse.js (search)
- Live reload: WebSocket (ws)

## Core Features
1. `tidoc serve [path|url]` — scan all .md files, serve on localhost:4000
2. `tidoc serve https://github.com/user/repo` — clone and serve from git repo
3. Auto sidebar from folder structure
4. Live reload on file change
5. Cmd/Ctrl+K search modal

## Git URL Support
- Detect URLs: https://, git://, or GitHub shorthand (user/repo)
- Shallow clone to OS temp dir, cleanup on exit
- Flags: --branch <name>, --subdir <path>
- Module: src/git.js — cloneRepo(url, options) → tmpDir path

## Project Structure
src/
  cli.js        # CLI entry point
  server.js     # Hono server
  scanner.js    # glob scan .md files
  watcher.js    # chokidar watch
  renderer.js   # marked parse md → html
  sidebar.js    # build sidebar tree
public/
  index.html
  app.js
  style.css