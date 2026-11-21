# md-viewer

A quiet markdown visualizer. Paste a document, drop a file or a folder, or pick one — the result is a
clean, readable page with nothing else on it except a nearly invisible open button in the top-left
corner.

Everything runs in the browser. No server, no upload, no editing UI.

## Folders

Pick a folder from the open menu (`⌘/Ctrl+O` for a file, `⌘/Ctrl+Shift+O` for a folder) or drop one
onto the page. The viewer scans the folder and all of its subfolders for Markdown files and mirrors
the structure in a ghosted files rail on the left. Clicking a file renders it; links between Markdown
files in the same folder open in place too. The first view is the shallowest `README.md`, then
`index.md`, then the first file alphabetically.

The files rail is available on wide screens (≥1280px), like the contents rail, which now sits on the
right. Hidden directories and common heavy ones (`node_modules`, `dist`, `build`, caches, `target`,
`vendor`, `Pods`, VCS folders) are skipped. On Chromium the folder picker uses the File System Access
API and never enters those folders, so large trees are pruned before anything is read. Other browsers
fall back to the standard folder input, which enumerates everything first; dropping a folder onto the
page avoids that cost because the drop walk prunes as it goes.

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
  and brightens on hover or keyboard focus
- A matching folder tree on the left (also on wide screens) mirrors the structure of an opened
  folder, with collapsible directories and the current file highlighted
- A matching ghost button in the top-right switches light/dark; the choice is remembered, and the OS
  preference is followed until the first toggle
- Fenced code with highlight.js (common languages)
- Inline `$...$` and block `$$...$$` math via KaTeX
- Automatic light and dark themes, and print styles
- Raw HTML is escaped; external links open in a new tab with `rel="noopener noreferrer"`

## Notes

- Documents are kept in `localStorage` so a reload doesn't lose the page you were reading.
  Large documents that exceed the storage quota are still viewable but won't be remembered.
- Folder contents are not persisted: after a reload the last viewed document is restored, but the
  file tree disappears until the folder is opened again. Links between files only resolve while
  that folder is open.
- Relative image paths (`./diagram.png`) cannot resolve in the browser; use absolute URLs or
  data URIs.
- Accepted inputs: `.md`, `.markdown`, `.mdown`, `.mkd`, `.txt`, any pasted text, or a folder
  containing them.
