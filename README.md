# md-viewer

A quiet markdown visualizer. Paste a document, drop a file, or pick one — the result is a clean,
readable page with nothing else on it except a nearly invisible open button in the top-left corner.

Everything runs in the browser. No server, no upload, no editing UI.

## Scripts

```bash
pnpm install
pnpm dev       # local development
pnpm build     # type-check and build to dist/
pnpm preview   # serve the production build
pnpm typecheck
```

`dist/` is a static site: host it anywhere, or serve it with `pnpm preview`. Opening
`dist/index.html` straight from disk will not work because browsers block ES modules over
`file://`.

## What it renders

- CommonMark plus GFM tables, task lists, strikethrough, autolinks, and footnotes
- Self-hosted Lato for reading text, system monospace for code
- Tables sit on a soft gray card so they stand out from the prose; long cells clamp to two lines with
  per-row expand controls and an expand-all icon above the table, so nothing scrolls sideways
- A ghosted contents rail on wide screens lists the H1–H3 headings, highlights the current section,
  and fades up on hover or keyboard focus
- A matching ghost button in the top-right switches light/dark; the choice is remembered, and the OS
  preference is followed until the first toggle
- Fenced code with highlight.js (common languages)
- Inline `$...$` and block `$$...$$` math via KaTeX
- Automatic light and dark themes, and print styles
- Raw HTML is escaped; external links open in a new tab with `rel="noopener noreferrer"`

## Notes

- Documents are kept in `localStorage` so a reload doesn't lose the page you were reading.
  Large documents that exceed the storage quota are still viewable but won't be remembered.
- Relative image paths (`./diagram.png`) cannot resolve in the browser; use absolute URLs or
  data URIs.
- Accepted inputs: `.md`, `.markdown`, `.mdown`, `.mkd`, `.txt`, or any pasted text.
