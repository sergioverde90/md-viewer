import '@fontsource/lato/400.css';
import '@fontsource/lato/400-italic.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/700-italic.css';
import './styles.css';
import 'katex/dist/katex.min.css';
import { renderMarkdown } from './render';
import { enhanceTables } from './tables';
import { buildToc, clearToc } from './toc';
import { initTheme } from './theme';
import { loadDocument, saveDocument } from './storage';
import {
  clearFolder,
  getFolderFile,
  isIgnoredDirectoryName,
  isMarkdownFile,
  isMarkdownPath,
  MAX_FILES,
  normalizePath,
  openFolder,
  resolveFolderLink,
  scanFileList,
  setActiveFolderFile,
  type ScannedFile,
} from './folder';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

type DirectoryPicker = (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const reader = must<HTMLElement>('#reader');
const emptyState = must<HTMLElement>('#empty');
const openButton = must<HTMLButtonElement>('#open');
const openMenu = must<HTMLElement>('#open-menu');
const dropzone = must<HTMLButtonElement>('#dropzone');
const dropzoneFolder = must<HTMLButtonElement>('#dropzone-folder');
const fileInput = must<HTMLInputElement>('#file');
const directoryInput = must<HTMLInputElement>('#directory');
const body = document.body;

const folderTexts = new Map<string, string>();
let currentPath = '';

initTheme();

function showDocument(name: string, text: string, options: { persist?: boolean } = {}): void {
  reader.innerHTML = renderMarkdown(text);

  const heading = reader.querySelector('h1')?.textContent?.trim();
  document.title = heading || name || 'Markdown';

  body.classList.remove('is-empty');
  emptyState.hidden = true;
  enhanceTables(reader);
  buildToc(reader);
  reader.focus({ preventScroll: true });
  window.scrollTo(0, 0);

  if (options.persist !== false) saveDocument({ name, text });
}

function showEmptyState(): void {
  reader.replaceChildren();
  clearToc();
  body.classList.add('is-empty');
  emptyState.hidden = false;
  document.title = 'Markdown';
}

function decode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function resetFolderContext(): void {
  clearFolder();
  folderTexts.clear();
  currentPath = '';
}

async function openSingleFile(file: File): Promise<void> {
  if (file.size > MAX_FILE_BYTES) {
    console.warn(`Ignoring ${file.name}: ${Math.round(file.size / 1024 / 1024)} MB exceeds the 20 MB limit.`);
    return;
  }

  try {
    const text = decode(await file.arrayBuffer());
    if (!text.trim()) return;
    resetFolderContext();
    currentPath = file.name;
    showDocument(file.name, text);
  } catch (error) {
    console.error(`Could not read ${file.name}`, error);
  }
}

async function openFolderFile(path: string, file: File): Promise<void> {
  try {
    let text = folderTexts.get(path);

    if (text === undefined) {
      if (file.size > MAX_FILE_BYTES) {
        console.warn(`Ignoring ${path}: ${Math.round(file.size / 1024 / 1024)} MB exceeds the 20 MB limit.`);
        return;
      }
      text = decode(await file.arrayBuffer());
      folderTexts.set(path, text);
    }

    if (!text.trim()) return;

    currentPath = path;
    setActiveFolderFile(path);
    showDocument(path, text);
  } catch (error) {
    console.error(`Could not read ${path}`, error);
  }
}

function openFolderFiles(files: ScannedFile[]): void {
  if (files.length === 0) {
    console.warn('No Markdown files found in that folder.');
    return;
  }

  folderTexts.clear();
  currentPath = '';

  const initial = openFolder(files, (path, file) => {
    void openFolderFile(path, file);
  });

  if (initial) void openFolderFile(initial.path, initial.file);
}

function openPicker(): void {
  fileInput.click();
}

function openFolderPicker(): void {
  void pickFolder();
}

function getDirectoryPicker(): DirectoryPicker | null {
  const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  return picker ? picker.bind(window) : null;
}

async function collectDirectory(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  out: ScannedFile[],
): Promise<void> {
  for await (const entry of handle.values()) {
    if (out.length >= MAX_FILES) return;

    if (entry.kind === 'directory') {
      if (!isIgnoredDirectoryName(entry.name)) {
        await collectDirectory(entry as FileSystemDirectoryHandle, `${prefix}/${entry.name}`, out);
      }
      continue;
    }

    if (!isMarkdownPath(entry.name)) continue;

    try {
      const file = await (entry as FileSystemFileHandle).getFile();
      out.push({ path: normalizePath(`${prefix}/${entry.name}`), file });
    } catch (error) {
      console.error(`Could not read ${entry.name}`, error);
    }
  }
}

async function pickFolder(): Promise<void> {
  const picker = getDirectoryPicker();

  if (picker) {
    try {
      const handle = await picker({ mode: 'read' });
      const files: ScannedFile[] = [];
      await collectDirectory(handle, handle.name, files);
      openFolderFiles(files);
      return;
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
        return;
      }
      console.error('Could not read the selected folder', error);
    }
  }

  directoryInput.click();
}

function setMenuOpen(open: boolean, moveFocus = false): void {
  openMenu.hidden = !open;
  openButton.setAttribute('aria-expanded', String(open));
  if (open && moveFocus) openMenu.querySelector<HTMLButtonElement>('button')?.focus();
}

function closeMenu(refocus = false): void {
  if (openMenu.hidden) return;
  const hadFocus = openMenu.contains(document.activeElement);
  setMenuOpen(false);
  if (refocus || hadFocus) openButton.focus();
}

openButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const open = Boolean(openMenu.hidden);
  setMenuOpen(open, open);
});

openMenu.addEventListener('click', (event) => {
  event.stopPropagation();
  const target = event.target;
  if (!(target instanceof Element)) return;
  const action = target.closest<HTMLButtonElement>('button[data-action]')?.dataset.action;

  closeMenu(true);
  if (action === 'file') openPicker();
  else if (action === 'folder') openFolderPicker();
});

document.addEventListener('click', () => closeMenu());

dropzone.addEventListener('click', openPicker);
dropzoneFolder.addEventListener('click', openFolderPicker);

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void openSingleFile(file);
});

directoryInput.addEventListener('change', () => {
  const files = Array.from(directoryInput.files ?? []);
  directoryInput.value = '';
  if (files.length === 0) return;
  openFolderFiles(scanFileList(files));
});

window.addEventListener('paste', (event) => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;

  const files = Array.from(clipboard.files);
  if (files.length > 0) {
    const file = files.find(isMarkdownFile);
    if (!file) return;
    event.preventDefault();
    void openSingleFile(file);
    return;
  }

  const text = clipboard.getData('text/plain');
  if (!text.trim()) return;

  event.preventDefault();
  resetFolderContext();
  currentPath = 'Pasted markdown';
  showDocument('Pasted markdown', text);
});

function readDirectoryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
}

function readEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntry, out: ScannedFile[]): Promise<void> {
  if (entry.isFile) {
    if (!isMarkdownPath(entry.name)) return;
    try {
      const file = await readEntryFile(entry as FileSystemFileEntry);
      out.push({ path: normalizePath(entry.fullPath), file });
    } catch (error) {
      console.error(`Could not read ${entry.fullPath}`, error);
    }
    return;
  }

  if (!entry.isDirectory || isIgnoredDirectoryName(entry.name)) return;

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await readDirectoryBatch(reader);
    if (batch.length === 0) break;
    await Promise.all(batch.map((child) => walkEntry(child, out)));
  }
}

async function collectDrop(event: DragEvent): Promise<void> {
  const transfer = event.dataTransfer;
  if (!transfer) return;

  const entries = Array.from(transfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length > 0) {
    const scanned: ScannedFile[] = [];
    let hasDirectory = false;

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.isDirectory) hasDirectory = true;
        await walkEntry(entry, scanned);
      }),
    );

    if (scanned.length > 0) {
      if (hasDirectory || scanned.length > 1) openFolderFiles(scanned);
      else void openSingleFile(scanned[0].file);
      return;
    }
  }

  const dropped = Array.from(transfer.files).filter(isMarkdownFile);
  if (dropped.length > 1) {
    openFolderFiles(dropped.map((file) => ({ path: file.name, file })));
  } else if (dropped.length === 1) {
    void openSingleFile(dropped[0]);
  }
}

let dragDepth = 0;

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function resetDrag(): void {
  dragDepth = 0;
  body.classList.remove('dragging');
}

window.addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth += 1;
  body.classList.add('dragging');
});

window.addEventListener('dragover', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('dragleave', (event) => {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) body.classList.remove('dragging');
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  resetDrag();
  void collectDrop(event);
});

window.addEventListener('blur', resetDrag);
window.addEventListener('dragend', resetDrag);

reader.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest('a');
  const href = anchor?.getAttribute('href');
  if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;

  const path = resolveFolderLink(currentPath, href);
  if (!path) return;

  const file = getFolderFile(path);
  if (!file) return;

  event.preventDefault();
  void openFolderFile(path, file);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !openMenu.hidden) {
    closeMenu(true);
    return;
  }

  const isOpenShortcut =
    (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'o';
  if (!isOpenShortcut) return;

  event.preventDefault();
  closeMenu();
  if (event.shiftKey) openFolderPicker();
  else openPicker();
});

const stored = loadDocument();
if (stored) {
  currentPath = stored.name;
  showDocument(stored.name, stored.text, { persist: false });
} else {
  showEmptyState();
}
