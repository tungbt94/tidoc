// ===== DOM Elements =====

const sidebarNav = document.getElementById("sidebar-nav");
const contentBody = document.getElementById("content-body");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const breadcrumb = document.getElementById("breadcrumb");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const searchTrigger = document.getElementById("search-trigger");
const searchModalOverlay = document.getElementById("search-modal-overlay");
const searchModal = document.getElementById("search-modal");
const searchModalInput = document.getElementById("search-modal-input");
const searchModalBody = document.getElementById("search-modal-body");
const searchModalCancel = document.getElementById("search-modal-cancel");

// ===== State =====

let fileTree = [];
let currentPath = null;
let searchDebounceTimer = null;
let miniSearch = null;
let searchDocs = {}; // id → {path, name, content}
let pendingScrollAnchor = null;

// ===== Dark Mode =====

/**
 * Apply a theme ("light" or "dark") to the page.
 * Toggles the data-theme attribute and highlight.js stylesheets.
 * @param {string} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const hljsLight = document.getElementById("hljs-light");
  const hljsDark = document.getElementById("hljs-dark");
  if (theme === "dark") {
    if (hljsLight) hljsLight.disabled = true;
    if (hljsDark) hljsDark.disabled = false;
    darkModeToggle.innerHTML = "&#9788;"; // sun
  } else {
    if (hljsLight) hljsLight.disabled = false;
    if (hljsDark) hljsDark.disabled = true;
    darkModeToggle.innerHTML = "&#9790;"; // moon
  }
}

/**
 * Initialize theme from localStorage or default to light.
 */
function initTheme() {
  const saved = localStorage.getItem("tidoc-theme");
  const theme = saved === "dark" ? "dark" : "light";
  applyTheme(theme);
}

darkModeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("tidoc-theme", next);
  applyTheme(next);
  if (window.__mermaid) {
    window.__mermaid.initialize({ theme: next === "dark" ? "dark" : "default" });
    // Re-render mermaid diagrams with new theme
    const mermaidEls = document.querySelectorAll(".content-body pre.mermaid");
    if (mermaidEls.length) {
      mermaidEls.forEach(el => { el.removeAttribute("data-processed"); el.innerHTML = el.getAttribute("data-original") || el.textContent; });
      window.__mermaid.run({ querySelector: ".content-body pre.mermaid" });
    }
  }
});

// Apply theme immediately
initTheme();

// Set Cmd/Ctrl key label based on platform
const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
document.querySelectorAll(".search-trigger-kbd-meta").forEach((el) => {
  el.textContent = isMac ? "\u2318" : "Ctrl+";
});

// ===== Sidebar Tree Rendering =====

/**
 * Render the file tree into the sidebar nav element.
 * @param {Array} tree - The file tree from /api/files
 * @param {HTMLElement} container - The container element
 */
function renderTree(tree, container) {
  const ul = document.createElement("ul");
  ul.className = "tree-list";

  for (const node of tree) {
    const li = document.createElement("li");
    li.className = "tree-item";

    if (node.type === "directory") {
      // Directory toggle button
      const toggle = document.createElement("button");
      toggle.className = "tree-dir-toggle open";
      toggle.innerHTML = `<span class="arrow">&#9654;</span> ${escapeHtml(node.name)}`;

      // Children container
      const childrenDiv = document.createElement("div");
      childrenDiv.className = "tree-dir-children";

      toggle.addEventListener("click", () => {
        toggle.classList.toggle("open");
        childrenDiv.classList.toggle("collapsed");
      });

      li.appendChild(toggle);
      renderTree(node.children, childrenDiv);
      li.appendChild(childrenDiv);
    } else {
      // File link
      const a = document.createElement("a");
      a.className = "tree-file-link";
      a.href = `#${node.path}`;
      a.textContent = node.name;
      a.dataset.path = node.path;

      a.addEventListener("click", (e) => {
        e.preventDefault();
        navigateTo(node.path);
      });

      li.appendChild(a);
    }

    ul.appendChild(li);
  }

  container.appendChild(ul);
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update the active state in the sidebar to reflect the currently viewed file.
 * @param {string} filePath - The relative path of the active file
 */
function updateActiveLink(filePath) {
  const links = sidebarNav.querySelectorAll(".tree-file-link");
  for (const link of links) {
    if (link.dataset.path === filePath) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  }
}

/**
 * Refresh the sidebar tree by re-fetching /api/files and re-rendering.
 */
async function refreshSidebar() {
  try {
    const res = await fetch("/api/files");
    if (!res.ok) return;
    fileTree = await res.json();
    sidebarNav.innerHTML = "";
    renderTree(fileTree, sidebarNav);
    if (currentPath) {
      updateActiveLink(currentPath);
    }
  } catch (err) {
    console.error("Error refreshing sidebar:", err);
  }
}

// ===== Breadcrumb =====

/**
 * Update the breadcrumb navigation based on the current file path.
 * @param {string} filePath - The relative path of the current file
 */
function updateBreadcrumb(filePath) {
  breadcrumb.innerHTML = "";
  if (!filePath) return;

  // Remove .md extension from the last segment for display
  const parts = filePath.split("/");
  const segments = parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    const displayName = isLast ? part.replace(/\.md$/i, "") : part;
    return { name: displayName, isLast };
  });

  segments.forEach((seg, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.textContent = ">";
      breadcrumb.appendChild(separator);
    }

    const crumb = document.createElement("span");
    crumb.className = seg.isLast ? "crumb-current" : "crumb";
    crumb.textContent = seg.name;
    breadcrumb.appendChild(crumb);
  });
}

// ===== Content Loading =====

/**
 * Fetch and display a markdown file's rendered HTML.
 * @param {string} filePath - The relative path to the .md file
 */
async function loadFile(filePath) {
  if (currentPath === filePath) return;

  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) {
      contentBody.innerHTML = `<p>Error loading file: ${escapeHtml(filePath)}</p>`;
      return;
    }

    const data = await res.json();
    contentBody.innerHTML = data.html;
    currentPath = filePath;

    // Update URL hash without triggering hashchange
    history.replaceState(null, "", `#${filePath}`);

    // Update sidebar active state
    updateActiveLink(filePath);

    // Update breadcrumb
    updateBreadcrumb(filePath);

    // Scroll to anchor if coming from search, otherwise scroll to top
    if (pendingScrollAnchor) {
      const anchorEl = document.getElementById(pendingScrollAnchor);
      if (anchorEl) {
        anchorEl.scrollIntoView({ behavior: "smooth" });
      } else {
        contentBody.scrollTop = 0;
        window.scrollTo(0, 0);
      }
      pendingScrollAnchor = null;
    } else {
      contentBody.scrollTop = 0;
      window.scrollTo(0, 0);
    }

    // Render mermaid diagrams
    if (window.__mermaid) {
      const mermaidEls = contentBody.querySelectorAll("pre.mermaid");
      mermaidEls.forEach(el => el.setAttribute("data-original", el.textContent));
      if (mermaidEls.length) {
        await window.__mermaid.run({ querySelector: '.content-body pre.mermaid' });
      }
    }

    // Update page title
    const fileName = filePath.split("/").pop().replace(/\.md$/i, "");
    document.title = `${fileName} - Tidoc`;
  } catch (err) {
    contentBody.innerHTML = `<p>Failed to load file.</p>`;
    console.error("Error loading file:", err);
  }
}

// ===== Navigation =====

/**
 * Navigate to a file path, updating the hash and loading the content.
 * @param {string} filePath - The relative path to navigate to
 */
function navigateTo(filePath) {
  window.location.hash = filePath;
}

/**
 * Get the file path from the current URL hash.
 * @returns {string|null}
 */
function getPathFromHash() {
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    return decodeURIComponent(hash.slice(1));
  }
  return null;
}

/**
 * Handle hash change events for client-side routing.
 */
function onHashChange() {
  const path = getPathFromHash();
  if (path) {
    // Reset currentPath so loadFile will proceed even if same file
    currentPath = null;
    loadFile(path);
  }
}

// ===== Search Modal =====

let searchActiveIndex = -1;
let searchResultItems = [];

function openSearchModal() {
  searchModalOverlay.classList.add("open");
  searchModalInput.value = "";
  searchModalBody.innerHTML = `<div class="search-modal-placeholder"><p>Type to search documentation</p></div>`;
  searchActiveIndex = -1;
  searchResultItems = [];
  // Focus after animation
  requestAnimationFrame(() => searchModalInput.focus());
}

function closeSearchModal() {
  searchModalOverlay.classList.remove("open");
  searchModalInput.value = "";
  searchActiveIndex = -1;
  searchResultItems = [];
}

function highlightQuery(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

/**
 * Build excerpt around the first match of query terms in content.
 */
function buildExcerpt(content, query) {
  const qLower = query.toLowerCase();
  const idx = content.toLowerCase().indexOf(qLower);
  if (idx === -1) return content.slice(0, 100).replace(/\n/g, " ") + "...";
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + qLower.length + 60);
  let excerpt = content.slice(start, end).replace(/\n/g, " ");
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt += "...";
  return excerpt;
}

/**
 * Slugify text the same way the server-side renderer does.
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find the heading slug for the section that contains the first match of query.
 * @param {string} content - Raw markdown content
 * @param {string} query - Search query
 * @returns {string|null} - Slugified heading or null
 */
function findMatchHeading(content, query) {
  const lines = content.split("\n");
  let lastHeading = null;
  const qLower = query.toLowerCase();
  let textSoFar = "";

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      // Check if query was found in the previous section
      if (lastHeading && textSoFar.toLowerCase().includes(qLower)) {
        return slugify(lastHeading);
      }
      lastHeading = headingMatch[2].trim();
      textSoFar = "";
    } else {
      textSoFar += line + "\n";
    }
  }
  // Check the last section
  if (lastHeading && textSoFar.toLowerCase().includes(qLower)) {
    return slugify(lastHeading);
  }
  return null; // match is before first heading or not found
}

function renderSearchResults(results, query) {
  searchModalBody.innerHTML = "";
  searchActiveIndex = -1;

  if (results.length === 0) {
    searchModalBody.innerHTML = `<div class="search-modal-placeholder"><p>No results for "${escapeHtml(query)}"</p></div>`;
    searchResultItems = [];
    return;
  }

  const list = document.createElement("ul");
  list.className = "search-modal-list";

  results.forEach((result, i) => {
    const li = document.createElement("li");
    li.className = "search-modal-item";
    li.dataset.index = i;
    li.dataset.path = result.path;

    const icon = `<svg class="search-item-icon" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 4h8l4 4v8a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" stroke="currentColor" stroke-width="1.5"/><path d="M12 4v4h4" stroke="currentColor" stroke-width="1.5"/></svg>`;

    const doc = searchDocs[result.id];
    const excerpt = doc ? buildExcerpt(doc.content, query) : "";
    const excerptHtml = excerpt
      ? `<span class="search-item-excerpt">${highlightQuery(escapeHtml(excerpt), query)}</span>`
      : "";

    // Find the heading anchor for the section containing the match
    const anchor = doc ? findMatchHeading(doc.content, query) : null;
    if (anchor) {
      li.dataset.anchor = anchor;
    }

    li.innerHTML = `${icon}<div class="search-item-content"><span class="search-item-path">${escapeHtml(result.path)}</span>${excerptHtml}</div><svg class="search-item-action" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 10h10m-4-4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    li.addEventListener("click", () => {
      pendingScrollAnchor = anchor;
      navigateTo(result.path);
      closeSearchModal();
    });

    li.addEventListener("mouseenter", () => {
      setActiveSearchItem(i);
    });

    list.appendChild(li);
  });

  searchModalBody.appendChild(list);
  searchResultItems = list.querySelectorAll(".search-modal-item");
}

function setActiveSearchItem(index) {
  searchResultItems.forEach((item) => item.classList.remove("active"));
  if (index >= 0 && index < searchResultItems.length) {
    searchActiveIndex = index;
    searchResultItems[index].classList.add("active");
    searchResultItems[index].scrollIntoView({ block: "nearest" });
  }
}

// Client-side search with MiniSearch (instant, no network)
searchModalInput.addEventListener("input", () => {
  const query = searchModalInput.value.trim();
  if (!query) {
    searchModalBody.innerHTML = `<div class="search-modal-placeholder"><p>Type to search documentation</p></div>`;
    searchResultItems = [];
    searchActiveIndex = -1;
    return;
  }
  if (!miniSearch) {
    searchModalBody.innerHTML = `<div class="search-modal-placeholder"><p>Search index loading...</p></div>`;
    return;
  }
  const results = miniSearch.search(query, { prefix: true, fuzzy: 0.2, boost: { name: 2 } });
  renderSearchResults(results.slice(0, 20), query);
});

// Keyboard navigation in modal
searchModalInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActiveSearchItem(Math.min(searchActiveIndex + 1, searchResultItems.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActiveSearchItem(Math.max(searchActiveIndex - 1, 0));
  } else if (e.key === "Enter" && searchActiveIndex >= 0) {
    e.preventDefault();
    const activeItem = searchResultItems[searchActiveIndex];
    const path = activeItem?.dataset.path;
    if (path) {
      pendingScrollAnchor = activeItem.dataset.anchor || null;
      navigateTo(path);
      closeSearchModal();
    }
  } else if (e.key === "Escape") {
    closeSearchModal();
  }
});

// Open/close triggers
searchTrigger.addEventListener("click", openSearchModal);
searchModalCancel.addEventListener("click", closeSearchModal);
searchModalOverlay.addEventListener("click", (e) => {
  if (e.target === searchModalOverlay) closeSearchModal();
});

// Cmd/Ctrl + K hotkey
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    if (searchModalOverlay.classList.contains("open")) {
      closeSearchModal();
    } else {
      openSearchModal();
    }
  }
});

// ===== WebSocket Live Reload =====

/**
 * Connect to the WebSocket server for live reload.
 * Automatically reconnects with exponential backoff on disconnection.
 */
function connectWebSocket() {
  let reconnectDelay = 1000;
  const maxDelay = 30000;

  function connect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/`);

    ws.addEventListener("open", () => {
      console.log("[tidoc] WebSocket connected");
      reconnectDelay = 1000; // Reset backoff on successful connection
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "reload") {
          console.log("[tidoc] Reloading...");
          // Re-fetch the current file
          const pathToReload = currentPath;
          currentPath = null;
          if (pathToReload) {
            loadFile(pathToReload);
          }
          // Refresh the sidebar tree and search index
          refreshSidebar();
          buildSearchIndex();
        }
      } catch (err) {
        console.error("[tidoc] WebSocket message error:", err);
      }
    });

    ws.addEventListener("close", () => {
      console.log(`[tidoc] WebSocket closed, reconnecting in ${reconnectDelay}ms...`);
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
        connect();
      }, reconnectDelay);
    });

    ws.addEventListener("error", (err) => {
      console.error("[tidoc] WebSocket error:", err);
      ws.close();
    });
  }

  connect();
}

// ===== Mobile Sidebar Toggle =====

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("open");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
}

sidebarToggle.addEventListener("click", () => {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarOverlay.addEventListener("click", closeSidebar);

// Close sidebar on mobile when a file link is clicked
sidebarNav.addEventListener("click", (e) => {
  if (e.target.classList.contains("tree-file-link")) {
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  }
});

// ===== Search Index (MiniSearch) =====

async function buildSearchIndex() {
  try {
    const res = await fetch("/api/search-index");
    if (!res.ok) return;
    const docs = await res.json();

    miniSearch = new MiniSearch({
      fields: ["name", "content"],
      storeFields: ["path", "name"],
      searchOptions: { prefix: true, fuzzy: 0.2 },
    });

    searchDocs = {};
    for (const doc of docs) {
      searchDocs[doc.id] = doc;
    }

    miniSearch.addAll(docs);
    console.log(`[tidoc] Search index built: ${docs.length} docs`);
  } catch (err) {
    console.error("[tidoc] Failed to build search index:", err);
  }
}

// ===== Initialization =====

async function init() {
  try {
    // Fetch the file tree
    const res = await fetch("/api/files");
    if (!res.ok) {
      sidebarNav.innerHTML = "<p>Failed to load file list.</p>";
      return;
    }

    fileTree = await res.json();

    // Render the sidebar tree
    renderTree(fileTree, sidebarNav);

    // Determine which file to load
    const hashPath = getPathFromHash();
    if (hashPath) {
      loadFile(hashPath);
    } else {
      // Try to load README.md by default
      const readmePath = findReadme(fileTree);
      if (readmePath) {
        loadFile(readmePath);
      } else {
        // Load the first file in the tree
        const firstFile = findFirstFile(fileTree);
        if (firstFile) {
          loadFile(firstFile);
        } else {
          contentBody.innerHTML = "<p>No documentation files found.</p>";
        }
      }
    }

    // Listen for hash changes
    window.addEventListener("hashchange", onHashChange);

    // Connect WebSocket for live reload
    connectWebSocket();

    // Build search index in background
    buildSearchIndex();
  } catch (err) {
    sidebarNav.innerHTML = "<p>Error connecting to server.</p>";
    contentBody.innerHTML = "<p>Failed to initialize.</p>";
    console.error("Init error:", err);
  }
}

/**
 * Find README.md in the file tree (top-level).
 * @param {Array} tree
 * @returns {string|null}
 */
function findReadme(tree) {
  for (const node of tree) {
    if (node.type === "file" && node.name.toLowerCase() === "readme") {
      return node.path;
    }
  }
  return null;
}

/**
 * Find the first file node in the tree (depth-first).
 * @param {Array} tree
 * @returns {string|null}
 */
function findFirstFile(tree) {
  for (const node of tree) {
    if (node.type === "file") {
      return node.path;
    }
    if (node.type === "directory" && node.children) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

// Start the app
init();
