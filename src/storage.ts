const STORAGE_KEY = 'md-viewer:document';

export interface StoredDocument {
  name: string;
  text: string;
  savedAt: number;
}

export function loadDocument(): StoredDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { name, text, savedAt } = parsed as Record<string, unknown>;
    if (typeof text !== 'string') return null;

    return {
      name: typeof name === 'string' ? name : 'Document',
      text,
      savedAt: typeof savedAt === 'number' ? savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveDocument(document: { name: string; text: string }): void {
  try {
    const payload: StoredDocument = { ...document, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable (private mode) or full (quota). Reading still works.
  }
}
