import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';

import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import html from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import yaml from 'highlight.js/lib/languages/yaml';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import xml from 'highlight.js/lib/languages/xml';
import diff from 'highlight.js/lib/languages/diff';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('html', html);
hljs.registerLanguage('css', css);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('diff', diff);

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
 * Custom code block renderer with highlight.js syntax highlighting.
 */
renderer.code = function ({ text, lang }) {
  const language = lang && hljs.getLanguage(lang) ? lang : null;
  let highlighted;

  if (language) {
    highlighted = hljs.highlight(text, { language }).value;
  } else {
    highlighted = hljs.highlightAuto(text).value;
  }

  const langClass = language ? ` language-${language}` : '';
  return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>\n`;
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
