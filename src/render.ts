import MarkdownIt, { type Env } from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import { katex } from '@mdit/plugin-katex';
import hljs from 'highlight.js/lib/common';

type RenderEnv = Env & { ids?: Map<string, number> };

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        // Fall through to the escaped plain-text rendering.
      }
    }
    return '';
  },
});

md.use(footnote);
md.use(taskLists);
md.use(katex, { throwOnError: false });

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const href = String(tokens[idx].attrGet('href') ?? '');
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const renderEnv = env as RenderEnv | undefined;
  const inline = tokens[idx + 1];
  if (inline?.type === 'inline') {
    const text = (inline.children ?? [])
      .map((child) => (child.type === 'text' || child.type === 'code_inline' ? child.content : ''))
      .join('')
      .trim();
    const slug = slugify(text);
    if (slug && renderEnv) {
      const ids = (renderEnv.ids ??= new Map());
      const count = ids.get(slug) ?? 0;
      ids.set(slug, count + 1);
      tokens[idx].attrSet('id', count === 0 ? slug : `${slug}-${count}`);
    }
  }
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.table_open = () => '<div class="table-wrap">\n<table>\n';
md.renderer.rules.table_close = () => '</table>\n</div>\n';

md.renderer.rules.th_open = (tokens, idx, options, _env, self) =>
  `${self.renderToken(tokens, idx, options)}<div class="cell">`;
md.renderer.rules.th_close = () => '</div></th>\n';
md.renderer.rules.td_open = (tokens, idx, options, _env, self) =>
  `${self.renderToken(tokens, idx, options)}<div class="cell">`;
md.renderer.rules.td_close = () => '</div></td>\n';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function renderMarkdown(source: string): string {
  const normalized = source.replace(/\r\n?/g, '\n');
  const env: RenderEnv = {};
  return md.render(normalized, env);
}
