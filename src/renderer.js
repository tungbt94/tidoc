import { marked } from 'marked';

/**
 * Convert heading text into a URL-friendly slug.
 *
 * @param {string} text - Raw heading text.
 * @returns {string} Slugified string.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const renderer = new marked.Renderer();

/**
 * Custom heading renderer that adds id attributes and anchor links.
 */
renderer.heading = function ({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const slug = slugify(tokens.map((t) => t.raw).join(''));
  return `<h${depth} id="${slug}"><a href="#${slug}">${text}</a></h${depth}>\n`;
};

/**
 * Custom code block renderer — adds language class for client-side highlight.js.
 */
renderer.code = function ({ text, lang }) {
  if (lang === 'mermaid') {
    return `<pre class="mermaid">${text}</pre>\n`;
  }
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const langClass = lang ? ` language-${lang}` : '';
  return `<pre><code class="hljs${langClass}">${escaped}</code></pre>\n`;
};

marked.setOptions({
  gfm: true,
  breaks: false,
  renderer,
});

/**
 * Render a markdown string to HTML.
 *
 * @param {string} content - Markdown source text.
 * @returns {string} Rendered HTML.
 */
export function renderMarkdown(content) {
  return marked.parse(content);
}
