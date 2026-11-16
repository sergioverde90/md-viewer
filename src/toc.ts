type Heading = { element: HTMLElement; id: string; text: string; level: number };

const MAX_LEVEL = 3;

let nav: HTMLElement | null = null;
let list: HTMLOListElement | null = null;
let headings: Heading[] = [];
let links = new Map<string, HTMLAnchorElement>();
let activeId = '';
let frame = 0;
let listening = false;

function ensureNav(): { nav: HTMLElement; list: HTMLOListElement } {
  if (nav && list) return { nav, list };

  nav = document.createElement('nav');
  nav.id = 'toc';
  nav.className = 'toc';
  nav.hidden = true;
  nav.setAttribute('aria-labelledby', 'toc-title');

  const title = document.createElement('p');
  title.id = 'toc-title';
  title.className = 'toc-title';
  title.textContent = 'Contents';

  list = document.createElement('ol');
  list.className = 'toc-list';

  nav.append(title, list);
  document.body.append(nav);

  return { nav, list };
}

function collectHeadings(reader: HTMLElement): Heading[] {
  const selector = Array.from({ length: MAX_LEVEL }, (_, index) => `h${index + 1}`).join(', ');

  return Array.from(reader.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
    const id = element.id;
    const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!id || !text) return [];
    if (element.closest('blockquote, .footnotes')) return [];
    return [{ element, id, text, level: Number(element.tagName.slice(1)) }];
  });
}

function keepInView(link: HTMLAnchorElement): void {
  if (!list || list.getClientRects().length === 0) return;

  const listRect = list.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const margin = 10;

  if (linkRect.top < listRect.top + margin) {
    list.scrollTop += linkRect.top - listRect.top - margin;
  } else if (linkRect.bottom > listRect.bottom - margin) {
    list.scrollTop += linkRect.bottom - listRect.bottom + margin;
  }
}

function setActive(id: string): void {
  if (id === activeId) return;
  activeId = id;

  for (const [linkId, link] of links) {
    const isActive = linkId === id;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }

  const link = links.get(id);
  if (link) keepInView(link);
}

function updateActive(): void {
  frame = 0;
  if (!nav || nav.hidden || headings.length === 0) return;

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll > 8 && window.scrollY >= maxScroll - 4) {
    setActive(headings[headings.length - 1].id);
    return;
  }

  const threshold = 120;
  let current = headings[0].id;
  for (const heading of headings) {
    if (heading.element.getBoundingClientRect().top <= threshold) current = heading.id;
  }
  setActive(current);
}

function scheduleUpdate(): void {
  if (frame !== 0) return;
  frame = window.requestAnimationFrame(updateActive);
}

function listen(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
}

export function buildToc(reader: HTMLElement): void {
  const elements = ensureNav();
  listen();

  headings = collectHeadings(reader);
  links = new Map();
  activeId = '';
  elements.list.replaceChildren();

  if (headings.length < 2) {
    elements.nav.hidden = true;
    return;
  }

  for (const heading of headings) {
    const item = document.createElement('li');
    const link = document.createElement('a');

    link.className = 'toc-link';
    link.setAttribute('href', `#${heading.id}`);
    link.dataset.level = String(heading.level);
    link.textContent = heading.text;
    link.title = heading.text;
    link.addEventListener('click', () => setActive(heading.id));

    links.set(heading.id, link);
    item.append(link);
    elements.list.append(item);
  }

  elements.nav.hidden = false;
  window.requestAnimationFrame(updateActive);
}

export function clearToc(): void {
  headings = [];
  links = new Map();
  activeId = '';
  if (nav) nav.hidden = true;
}
