const ROW_ICONS = `
<svg class="icon-expand" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
<svg class="icon-collapse" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
`;

const TABLE_ICONS = `
<svg class="icon-expand" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" /></svg>
<svg class="icon-collapse" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" x2="21" y1="10" y2="3" /><line x1="3" x2="10" y1="21" y2="14" /></svg>
`;

let tableRoot: HTMLElement | null = null;
let refreshFrame = 0;
let resizeBound = false;

function bodyRows(wrap: HTMLElement): HTMLTableRowElement[] {
  return Array.from(wrap.querySelectorAll<HTMLTableRowElement>('tbody tr'));
}

function rowNumber(row: HTMLTableRowElement): number {
  const parent = row.parentElement;
  return parent ? Array.from(parent.children).indexOf(row) + 1 : 1;
}

function rowOverflows(row: HTMLTableRowElement): boolean {
  for (const cell of row.querySelectorAll<HTMLElement>('.cell')) {
    if (cell.scrollHeight > cell.clientHeight + 1) return true;
  }
  return false;
}

function createRowToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'row-toggle';
  button.innerHTML = ROW_ICONS;
  return button;
}

function createTableToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'table-toggle';
  button.hidden = true;
  button.innerHTML = TABLE_ICONS;
  return button;
}

function syncRow(row: HTMLTableRowElement): void {
  const toggle = row.querySelector<HTMLButtonElement>('.row-toggle');
  if (!toggle) return;

  const expanded = row.classList.contains('is-row-expanded');
  const label = `${expanded ? 'Collapse' : 'Expand'} row ${rowNumber(row)}`;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
}

function syncTable(wrap: HTMLElement): void {
  const master = wrap.querySelector<HTMLButtonElement>('.table-toggle');
  if (!master) return;

  const rows = bodyRows(wrap).filter((row) => row.querySelector('.row-toggle'));
  const allExpanded = rows.length > 0 && rows.every((row) => row.classList.contains('is-row-expanded'));
  const label = allExpanded ? 'Collapse all rows' : 'Expand all rows';

  master.hidden = rows.length === 0;
  master.setAttribute('aria-expanded', String(allExpanded));
  master.setAttribute('aria-label', label);
  master.title = label;
}

function addRowToggle(row: HTMLTableRowElement): void {
  const lastCell = row.lastElementChild;
  if (!(lastCell instanceof HTMLTableCellElement)) return;

  const button = createRowToggle();
  button.addEventListener('click', () => {
    row.classList.toggle('is-row-expanded');
    syncRow(row);

    const wrap = row.closest<HTMLElement>('.table-wrap');
    if (wrap) syncTable(wrap);
  });

  lastCell.classList.add('has-row-toggle');
  lastCell.append(button);
  syncRow(row);
}

function removeRowToggle(row: HTMLTableRowElement): void {
  row.querySelector('.row-toggle')?.remove();
  row.lastElementChild?.classList.remove('has-row-toggle');
  row.classList.remove('is-row-expanded');
}

function toggleAll(wrap: HTMLElement): void {
  const rows = bodyRows(wrap).filter((row) => row.querySelector('.row-toggle'));
  if (rows.length === 0) return;

  const allExpanded = rows.every((row) => row.classList.contains('is-row-expanded'));
  for (const row of rows) {
    row.classList.toggle('is-row-expanded', !allExpanded);
    syncRow(row);
  }
  syncTable(wrap);
}

function refreshTable(wrap: HTMLElement): void {
  for (const row of bodyRows(wrap)) {
    if (!row.classList.contains('is-row-expanded')) {
      const needsToggle = rowOverflows(row);
      const hasToggle = Boolean(row.querySelector('.row-toggle'));

      if (needsToggle && !hasToggle) addRowToggle(row);
      else if (!needsToggle && hasToggle) removeRowToggle(row);
    }
    syncRow(row);
  }
  syncTable(wrap);
}

function enhanceTable(wrap: HTMLElement): void {
  let master = wrap.querySelector<HTMLButtonElement>('.table-toggle');
  if (!master) {
    master = createTableToggle();
    master.addEventListener('click', () => toggleAll(wrap));
    wrap.prepend(master);
  }
  refreshTable(wrap);
}

function scheduleRefresh(): void {
  if (refreshFrame !== 0) return;
  refreshFrame = window.requestAnimationFrame(() => {
    refreshFrame = 0;
    if (!tableRoot) return;
    tableRoot.querySelectorAll<HTMLElement>('.table-wrap').forEach(refreshTable);
  });
}

export function enhanceTables(reader: HTMLElement): void {
  tableRoot = reader;

  if (!resizeBound) {
    resizeBound = true;
    window.addEventListener('resize', scheduleRefresh);
  }

  reader.querySelectorAll<HTMLElement>('.table-wrap').forEach(enhanceTable);
  void document.fonts?.ready.then(scheduleRefresh);
}
