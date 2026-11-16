type Theme = 'light' | 'dark';

const STORAGE_KEY = 'md-viewer:theme';
const root = document.documentElement;

let explicit = false;
let media: MediaQueryList | null = null;

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the choice holds for this session.
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function currentTheme(): Theme {
  return root.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  root.dataset.theme = theme;

  const button = document.querySelector<HTMLButtonElement>('#theme');
  if (!button) return;

  const next = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} mode`;
  button.setAttribute('aria-label', label);
  button.title = label;
}

function onSystemChange(): void {
  if (!explicit) applyTheme(systemTheme());
}

export function initTheme(): void {
  const stored = readStoredTheme();
  explicit = stored !== null;
  applyTheme(stored ?? systemTheme());

  media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onSystemChange);

  document.querySelector<HTMLButtonElement>('#theme')?.addEventListener('click', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    explicit = true;
    applyTheme(next);
    saveTheme(next);
  });
}
