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

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const reader = must<HTMLElement>('#reader');
const emptyState = must<HTMLElement>('#empty');
const openButton = must<HTMLButtonElement>('#open');
const dropzone = must<HTMLButtonElement>('#dropzone');
const fileInput = must<HTMLInputElement>('#file');
const body = document.body;

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

async function ingest(file: File): Promise<void> {
  if (file.size > MAX_FILE_BYTES) {
    console.warn(`Ignoring ${file.name}: ${Math.round(file.size / 1024 / 1024)} MB exceeds the 20 MB limit.`);
    return;
  }

  try {
    const text = decode(await file.arrayBuffer());
    if (!text.trim()) return;
    showDocument(file.name, text);
  } catch (error) {
    console.error(`Could not read ${file.name}`, error);
  }
}

function isMarkdownish(file: File): boolean {
  return /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name) || /^text\/(markdown|plain)/i.test(file.type);
}

function openPicker(): void {
  fileInput.click();
}

openButton.addEventListener('click', openPicker);
dropzone.addEventListener('click', openPicker);

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void ingest(file);
});

window.addEventListener('paste', (event) => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;

  const files = Array.from(clipboard.files);
  if (files.length > 0) {
    const file = files.find(isMarkdownish);
    if (!file) return;
    event.preventDefault();
    void ingest(file);
    return;
  }

  const text = clipboard.getData('text/plain');
  if (!text.trim()) return;

  event.preventDefault();
  showDocument('Pasted markdown', text);
});

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

  const file = event.dataTransfer?.files[0];
  if (file) void ingest(file);
});

window.addEventListener('blur', resetDrag);
window.addEventListener('dragend', resetDrag);

window.addEventListener('keydown', (event) => {
  const isOpenShortcut =
    (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'o';
  if (!isOpenShortcut) return;

  event.preventDefault();
  openPicker();
});

const stored = loadDocument();
if (stored) {
  showDocument(stored.name, stored.text, { persist: false });
} else {
  showEmptyState();
}
