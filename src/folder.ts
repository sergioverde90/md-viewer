const MARKDOWN_EXTENSION = /\.(md|markdown|mdown|mkd|txt)$/i;
const MARKDOWN_MIME = /^text\/(markdown|plain)/i;
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'bower_components',
  'Pods',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.venv',
  'venv',
  'target',
  'vendor',
  '.git',
  '.svn',
  '.hg',
  '.obsidian',
  '.trash',
]);
export const MAX_FILES = 2500;

export interface ScannedFile {
  path: string;
  file: File;
}

interface FileEntry {
  kind: 'file';
  name: string;
  path: string;
}

interface DirEntry {
  kind: 'dir';
  name: string;
  path: string;
  children: Entry[];
}

type Entry = FileEntry | DirEntry;

const CHEVRON_ICON =
  '<svg class="tree-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>';
const FOLDER_ICON =
  '<svg class="tree-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h3.9a1.75 1.75 0 0 1 1.4.7l.9 1.2a1.75 1.75 0 0 0 1.4.7h6.9A1.75 1.75 0 0 1 21 9.35v8.9A1.75 1.75 0 0 1 19.25 20H4.75A1.75 1.75 0 0 1 3 18.25z" /></svg>';
const FILE_ICON =
  '<svg class="tree-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>';
const SPACER = '<span class="tree-spacer" aria-hidden="true"></span>';

let nav: HTMLElement | null = null;
let body: HTMLElement | null = null;
let rootLabel: HTMLElement | null = null;
let files = new Map<string, File>();
let activePath = '';
let activeButton: HTMLButtonElement | null = null;
let baseRoot = '';
let opener: ((path: string, file: File) => void) | null = null;

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSION.test(path);
}

export function isMarkdownFile(file: File): boolean {
  return isMarkdownPath(file.name) || MARKDOWN_MIME.test(file.type);
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

export function isIgnoredDirectoryName(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRECTORIES.has(name);
}

function isIgnoredPath(path: string): boolean {
  return path
    .split('/')
    .some((segment, index) => index > 0 && isIgnoredDirectoryName(segment));
}

export function scanFileList(list: Iterable<File>): ScannedFile[] {
  const scanned: ScannedFile[] = [];

  for (const file of list) {
    if (!isMarkdownFile(file)) continue;
    const path = normalizePath(file.webkitRelativePath || file.name);
    if (!path || isIgnoredPath(path)) continue;
    scanned.push({ path, file });
    if (scanned.length >= MAX_FILES) break;
  }

  return scanned;
}

function sortEntries(dir: DirEntry): void {
  dir.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (const child of dir.children) {
    if (child.kind === 'dir') sortEntries(child);
  }
}

function buildTree(input: ScannedFile[]): { root: DirEntry; map: Map<string, File> } {
  const root: DirEntry = { kind: 'dir', name: '', path: '', children: [] };
  const map = new Map<string, File>();

  for (const { path, file } of input) {
    if (map.has(path)) continue;
    map.set(path, file);

    const segments = path.split('/');
    let dir = root;

    for (let index = 0; index < segments.length; index += 1) {
      const name = segments[index];

      if (index === segments.length - 1) {
        dir.children.push({ kind: 'file', name, path });
        continue;
      }

      const childPath = segments.slice(0, index + 1).join('/');
      let next = dir.children.find((child): child is DirEntry => child.kind === 'dir' && child.name === name);

      if (!next) {
        next = { kind: 'dir', name, path: childPath, children: [] };
        dir.children.push(next);
      }

      dir = next;
    }
  }

  sortEntries(root);
  return { root, map };
}

/** A picked folder becomes the tree's root instead of an expandable row. */
function displayRoot(root: DirEntry): DirEntry {
  if (root.children.length === 1 && root.children[0].kind === 'dir') return root.children[0];
  return root;
}

function pathDepth(path: string): number {
  return path.split('/').length;
}

function pickInitialPath(paths: Iterable<string>): string | null {
  const list = Array.from(paths).sort(
    (a, b) => pathDepth(a) - pathDepth(b) || a.localeCompare(b, undefined, { numeric: true }),
  );

  return (
    list.find((path) => /(^|\/)readme\.(md|markdown|mdown|mkd)$/i.test(path)) ??
    list.find((path) => /(^|\/)index\.(md|markdown|mdown|mkd)$/i.test(path)) ??
    list[0] ??
    null
  );
}

function ensureNav(): HTMLElement {
  if (nav) return nav;

  nav = document.createElement('nav');
  nav.id = 'files';
  nav.className = 'file-tree';
  nav.hidden = true;
  nav.setAttribute('aria-labelledby', 'files-title');

  const header = document.createElement('div');
  header.className = 'file-tree-header';

  const heading = document.createElement('p');
  heading.id = 'files-title';
  heading.className = 'file-tree-title';
  heading.textContent = 'Files';

  header.append(heading);

  rootLabel = document.createElement('p');
  rootLabel.className = 'file-tree-root';

  body = document.createElement('div');
  body.className = 'file-tree-body';

  nav.append(header, rootLabel, body);
  document.body.append(nav);

  return nav;
}

function renderEntries(entries: Entry[], container: HTMLElement, depth: number): void {
  const list = document.createElement('ul');
  list.className = 'tree-list';
  if (depth > 0) list.classList.add('tree-nested');

  for (const entry of entries) {
    const item = document.createElement('li');
    item.className = 'tree-item';

    if (entry.kind === 'dir') {
      const details = document.createElement('details');
      details.className = 'tree-dir';
      details.open = true;

      const summary = document.createElement('summary');
      summary.className = 'tree-row tree-dir-row';
      summary.title = entry.path;

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = entry.name;

      summary.innerHTML = `${CHEVRON_ICON}${FOLDER_ICON}`;
      summary.append(label);

      details.append(summary);
      renderEntries(entry.children, details, depth + 1);
      item.append(details);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tree-row tree-file-row';
      button.dataset.path = entry.path;
      button.title = entry.path;

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = entry.name;

      button.innerHTML = `${SPACER}${FILE_ICON}`;
      button.append(label);
      button.addEventListener('click', () => selectFile(entry.path));
      item.append(button);
    }

    list.append(item);
  }

  container.append(list);
}

function revealActive(): void {
  if (!body || !activeButton) return;

  const bodyRect = body.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();

  if (buttonRect.top < bodyRect.top) {
    body.scrollTop += buttonRect.top - bodyRect.top - 8;
  } else if (buttonRect.bottom > bodyRect.bottom) {
    body.scrollTop += buttonRect.bottom - bodyRect.bottom + 8;
  }
}

export function setActiveFolderFile(path: string): void {
  if (path === activePath && activeButton) return;
  activePath = path;

  if (activeButton) {
    activeButton.classList.remove('is-active');
    activeButton.removeAttribute('aria-current');
  }

  activeButton = nav
    ? (Array.from(nav.querySelectorAll<HTMLButtonElement>('.tree-file-row')).find(
        (button) => button.dataset.path === path,
      ) ?? null)
    : null;

  if (activeButton) {
    activeButton.classList.add('is-active');
    activeButton.setAttribute('aria-current', 'page');

    let details = activeButton.closest('details');
    while (details) {
      details.open = true;
      details = details.parentElement?.closest('details') ?? null;
    }

    revealActive();
  }
}

function selectFile(path: string): void {
  const file = files.get(path);
  if (!file) return;
  setActiveFolderFile(path);
  opener?.(path, file);
}

export function openFolder(
  input: ScannedFile[],
  onOpen: (path: string, file: File) => void,
): ScannedFile | null {
  const capped = input.length > MAX_FILES ? input.slice(0, MAX_FILES) : input;
  if (input.length > MAX_FILES) {
    console.warn(`Showing the first ${MAX_FILES} Markdown files from this folder.`);
  }

  const { root, map } = buildTree(capped);
  if (map.size === 0) {
    clearFolder();
    return null;
  }

  const element = ensureNav();
  const shown = displayRoot(root);

  opener = onOpen;
  files = map;
  baseRoot = shown.name;
  activePath = '';
  activeButton = null;

  if (rootLabel) rootLabel.textContent = shown.name;

  if (body) {
    body.replaceChildren();
    renderEntries(shown.children, body, 0);
    body.scrollTop = 0;
  }

  element.hidden = false;

  const initialPath = pickInitialPath(map.keys());
  return initialPath ? { path: initialPath, file: map.get(initialPath)! } : null;
}

export function clearFolder(): void {
  if (nav) nav.hidden = true;
  if (body) body.replaceChildren();
  if (rootLabel) rootLabel.textContent = '';

  files = new Map();
  activePath = '';
  activeButton = null;
  baseRoot = '';
  opener = null;
}

export function getFolderFile(path: string): File | null {
  return files.get(path) ?? null;
}

function collapsePath(path: string): string {
  const output: string[] = [];

  for (const segment of normalizePath(path).split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') output.pop();
    else output.push(segment);
  }

  return output.join('/');
}

/** Resolve a relative Markdown link against the open folder, if it points at a known file. */
export function resolveFolderLink(fromPath: string, href: string): string | null {
  if (files.size === 0) return null;

  const cleaned = href.split('#')[0].split('?')[0];
  if (!cleaned) return null;

  let target = cleaned;
  try {
    target = decodeURIComponent(target);
  } catch {
    // Keep the raw value when the URL encoding is malformed.
  }

  if (!isMarkdownPath(target)) return null;

  if (target.startsWith('/')) {
    target = baseRoot ? `${baseRoot}${target}` : target.slice(1);
  } else {
    const slash = fromPath.lastIndexOf('/');
    const directory = slash >= 0 ? fromPath.slice(0, slash) : '';
    target = directory ? `${directory}/${target}` : target;
  }

  target = collapsePath(target);
  return files.has(target) ? target : null;
}
