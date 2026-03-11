# Tidoc — Project Plan

> CLI tool that scans all `.md` files in a project and serves them as a documentation website.

---

## 1. Overview

| | |
|---|---|
| **Name** | Tidoc |
| **Stack** | Node.js (ESM), Hono, glob, marked, chokidar, ws, Pico.css, Fuse.js |
| **CLI** | `tidoc serve [path]` |
| **Output** | Web doc tại `http://localhost:4000` |

---

## 2. Project Structure

```
tidoc/
├── CLAUDE.md              ← brief cho Claude Code
├── package.json
├── bin/
│   └── tidoc.js           ← CLI entry (npx tidoc)
├── src/
│   ├── cli.js             ← parse args, gọi serve
│   ├── server.js          ← Hono server + WebSocket
│   ├── scanner.js         ← glob scan .md files
│   ├── watcher.js         ← chokidar watch changes
│   ├── renderer.js        ← marked parse md → html
│   └── sidebar.js         ← build file tree → sidebar
└── public/
    ├── index.html         ← shell HTML
    ├── app.js             ← client-side: routing, search, live reload
    └── style.css          ← Pico.css overrides
```

---

## 3. Milestones

### Phase 1 — Core (MVP)
**Goal:** `tidoc serve` chạy được, hiển thị file .md cơ bản

- [ ] Scaffold project + `package.json`
- [ ] `scanner.js` — glob scan toàn bộ `.md`, bỏ qua `node_modules/`, `.git/`
- [ ] `renderer.js` — marked parse md → HTML, support GFM (tables, code blocks)
- [ ] `sidebar.js` — build tree từ file paths, group theo folder
- [ ] `server.js` — Hono serve:
  - `GET /api/files` → danh sách files (JSON)
  - `GET /api/file?path=...` → nội dung HTML của 1 file
  - `GET /` → serve `index.html`
- [ ] `public/index.html` + `app.js` — render sidebar + content khi click
- [ ] `cli.js` + `bin/tidoc.js` — `tidoc serve [path]` wire everything lại

**Deliverable:** `npx tidoc serve .` → mở browser thấy docs ✅

---

### Phase 2 — Live Reload
**Goal:** Sửa file `.md` → browser tự refresh

- [ ] `watcher.js` — chokidar watch directory
- [ ] `server.js` — thêm WebSocket endpoint `/ws`
- [ ] `public/app.js` — connect WebSocket, reload khi nhận event

---

### Phase 3 — Search
**Goal:** Search full-text trong toàn bộ docs

- [ ] Index tất cả file content vào memory khi start
- [ ] `GET /api/search?q=...` → trả về matched files + excerpt
- [ ] Frontend: search box + kết quả dropdown dùng Fuse.js

---

### Phase 4 — Polish
**Goal:** UX tốt hơn, sẵn sàng dùng thực tế

- [ ] Active state sidebar item khi đang đọc
- [ ] Breadcrumb navigation
- [ ] Code syntax highlighting (highlight.js)
- [ ] Anchor links cho headings
- [ ] Dark mode toggle
- [ ] `tidoc serve --port 3000` flag
- [ ] `tidoc serve --ignore "drafts/**"` flag

---

## 4. CLAUDE.md (copy vào project)

```markdown
# Tidoc

CLI tool that scans all .md files in a project and serves them 
as a documentation website.

## Tech Stack
- Runtime: Node.js ESM (type: "module" in package.json)
- Server: Hono
- Markdown: marked (GFM enabled)
- File scan: glob
- File watch: chokidar
- Live reload: ws (WebSocket)
- Frontend: Vanilla JS + Pico.css CDN + Fuse.js CDN

## CLI Usage
tidoc serve [path]          # default path = cwd
tidoc serve . --port 3000
tidoc serve ./docs

## API Routes
GET /                        → serve public/index.html
GET /api/files               → JSON tree of all .md files
GET /api/file?path=README.md → rendered HTML content
GET /api/search?q=keyword    → search results
WS  /ws                      → live reload events

## Key Behaviors
- Scan ignores: node_modules/, .git/, .tidoc/, dist/, build/
- File paths in API are relative to served root
- Sidebar groups files by folder, sorted alphabetically
- README.md in a folder shown first in that group

## Current Phase
Phase 1 — Core MVP
```

---

## 5. Thứ tự implement với Claude Code

```bash
# Bắt đầu
mkdir tidoc && cd tidoc
git init
# Copy CLAUDE.md vào đây

# Mở Claude Code
claude
```

**Prompt sequence gợi ý:**

```
1. "Read CLAUDE.md, scaffold full project structure 
    with package.json (ESM), empty files"

2. "Implement scanner.js — glob scan .md files, 
    return array of {path, relativePath, name}"

3. "Implement renderer.js + sidebar.js"

4. "Implement server.js with Hono — 3 API routes + 
    serve public folder"

5. "Create public/index.html + app.js — sidebar + 
    content rendering"

6. "Implement cli.js + bin/tidoc.js, wire everything"

7. "Test: run tidoc serve on current project, 
    fix any issues"
```

---

## 6. Publish (sau này)

```bash
npm publish --access public  # → npx tidoc serve .
```

Tên package npm: `tidoc` hoặc `@username/tidoc`
```