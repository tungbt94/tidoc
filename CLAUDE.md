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
1. `tidoc serve [path]` — scan all .md files, serve on localhost:4000
2. Auto sidebar from folder structure
3. Live reload on file change
4. Client-side search with Fuse.js

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