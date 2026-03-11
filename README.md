# Tidoc

Zero-config CLI that turns your Markdown files into a documentation website.

Point it at any folder with `.md` files and get a live, searchable docs site on localhost.

## Quick Start

```bash
npx @zerohat/tidoc serve
```

Or install globally:

```bash
npm i -g @zerohat/tidoc
tidoc serve ./docs
```

## Features

- **Zero config** -- just run `tidoc serve` in any project
- **Serve from GitHub** -- `tidoc serve user/repo` clones and serves any public repo
- **Auto sidebar** -- folder structure becomes navigation, README.md shown first
- **Live reload** -- edit a `.md` file, browser updates instantly via WebSocket
- **Search** -- Cmd/Ctrl+K opens a search modal with full-text search
- **Syntax highlighting** -- code blocks highlighted with highlight.js
- **Dark mode** -- toggle with one click, preference saved
- **Breadcrumb nav** -- always know where you are
- **Anchor links** -- every heading is linkable
- **Responsive** -- works on mobile with slide-out sidebar

## Usage

```bash
tidoc serve [path|url] [options]
```

| Option | Description | Default |
|---|---|---|
| `[path]` | Directory to serve | `.` (current dir) |
| `[url]` | Git URL or GitHub shorthand (`user/repo`) | -- |
| `--port <number>` | Port to listen on | `4000` |
| `--branch <name>` | Git branch to clone | default branch |
| `--subdir <path>` | Subdirectory within repo to serve | repo root |
| `--ignore <pattern>` | Glob pattern to exclude (repeatable) | -- |
| `--help, -h` | Show help | -- |

### Examples

```bash
# Serve current directory
tidoc serve

# Serve a specific folder on port 3000
tidoc serve ./docs --port 3000

# Serve from a GitHub repo
tidoc serve honojs/hono
tidoc serve https://github.com/honojs/hono

# Serve a specific branch and subdirectory
tidoc serve user/repo --branch main --subdir docs

# Ignore draft files
tidoc serve --ignore "drafts/**" --ignore "private/**"
```

## How It Works

Tidoc scans all `.md` files recursively (ignoring `node_modules`, `.git`, `dist`, `build`), parses them with [marked](https://marked.js.org/) (GFM), and serves them via [Hono](https://hono.dev/). File changes are watched with [chokidar](https://github.com/paulmillr/chokidar) and pushed to the browser over WebSocket.

## Tech Stack

| | |
|---|---|
| Server | [Hono](https://hono.dev/) + [@hono/node-server](https://github.com/honojs/node-server) |
| Markdown | [marked](https://marked.js.org/) (GFM) |
| File scan | [glob](https://github.com/isaacs/node-glob) |
| File watch | [chokidar](https://github.com/paulmillr/chokidar) |
| Live reload | [ws](https://github.com/websockets/ws) (WebSocket) |
| Highlighting | [highlight.js](https://highlightjs.org/) |
| Styling | [Pico.css](https://picocss.com/) |

## License

MIT
