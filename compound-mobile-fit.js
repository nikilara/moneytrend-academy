/** Compact only digit-group separators, without rounding or changing a value. */
export function compactMoneyText(text) {
  return String(text).replace(/(\d)[ \u00a0\u202f\u2009](?=\d)/g, '$1');
}

/**
 * Measure the real browser font, including OpenType tabular digits. Canvas.font
 * does not include font-variant-numeric, so use a temporary, invisible DOM node.
 * measureMany batches writes before reads to avoid one layout per table cell.
 */
export function createTextMeasurer(referenceElement) {
  const doc = referenceElement.ownerDocument || document;
  const view = doc.defaultView || window;
  const computed = view.getComputedStyle(referenceElement);
  const host = doc.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'all:initial;position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;display:block;width:max-content;max-width:none;padding:0;margin:0;border:0;white-space:pre;box-sizing:content-box;';
  for (const property of [
    'font-family', 'font-style', 'font-stretch', 'font-variant',
    'font-variant-numeric', 'font-feature-settings', 'font-variation-settings',
    'font-kerning', 'font-optical-sizing', 'font-variant-ligatures',
    'letter-spacing', 'word-spacing', 'text-rendering', 'text-transform'
  ]) {
    const value = computed.getPropertyValue(property);
    if (value) host.style.setProperty(property, value);
  }
  const defaultSize = parseFloat(computed.fontSize) || 12;
  const defaultWeight = computed.fontWeight || '400';
  const cache = new Map();
  (doc.body || doc.documentElement).append(host);

  function requestFor(value) {
    const item = typeof value === 'string' ? { text: value } : value;
    const size = Number.isFinite(item.size) && item.size > 0 ? item.size : defaultSize;
    const weight = String(item.weight ?? defaultWeight);
    const text = String(item.text);
    return { text, size, weight, key: JSON.stringify([text, size, weight]) };
  }
  function measureMany(values) {
    const requests = values.map(requestFor);
    const pending = new Map();
    const fragment = doc.createDocumentFragment();
    requests.forEach(request => {
      if (cache.has(request.key) || pending.has(request.key)) return;
      const span = doc.createElement('span');
      span.style.cssText = 'display:block;width:max-content;max-width:none;padding:0;margin:0;border:0;white-space:pre;box-sizing:content-box;';
      span.style.fontSize = request.size + 'px';
      span.style.fontWeight = request.weight;
      span.textContent = request.text;
      pending.set(request.key, span);
      fragment.append(span);
    });
    if (pending.size) {
      host.replaceChildren(fragment);
      pending.forEach((span, key) => {
        const width = span.getBoundingClientRect().width;
        cache.set(key, Number.isFinite(width) ? Math.max(0, width) : 0);
      });
      host.replaceChildren();
    }
    return requests.map(request => cache.get(request.key));
  }
  return {
    measure(text, size = defaultSize, weight = defaultWeight) {
      return measureMany([{ text, size, weight }])[0];
    },
    measureMany,
    destroy() { host.remove(); cache.clear(); }
  };
}

const originals = new WeakMap();

/** Fit exact, unbroken monetary strings in an already opened mobile table. */
export function fitMobileTable(table) {
  if (!table) return;
  const doc = table.ownerDocument || document;
  const view = doc.defaultView || window;
  const columns = [[], [], []];
  table.querySelectorAll('tbody tr').forEach(row => {
    Array.from(row.children).slice(1, 4).forEach((cell, index) => {
      const existing = originals.get(cell);
      const current = cell.textContent;
      const full = existing && (current === existing.full || current === existing.compact)
        ? existing.full : current;
      const compact = compactMoneyText(full);
      originals.set(cell, { full, compact });
      if (current !== compact) cell.textContent = compact;
      cell.setAttribute('title', full);
      cell.setAttribute('aria-label', full);
      // Remove a previous mobile fit before measuring the canonical base size.
      cell.style.removeProperty('--compound-mobile-money-size');
      columns[index].push(cell);
    });
  });

  columns.forEach(cells => {
    if (!cells.length) return;
    const computed = view.getComputedStyle(cells[0]);
    const base = parseFloat(computed.fontSize) || 12;
    const padding = (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
    const measure = createTextMeasurer(cells[0]);
    try {
      const jobs = cells.map(cell => ({
        cell, text: cell.textContent,
        available: Math.max(0, cell.getBoundingClientRect().width - padding - 1)
      }));
      const widths = measure.measureMany(jobs.map(job => ({ text: job.text, size: base })));
      jobs.forEach((job, index) => {
        const width = widths[index];
        job.size = width > job.available && job.available > 0
          ? Math.max(.01, Math.floor(base * job.available / width * 100) / 100) : base;
      });
      // Fractional font sizes and hinting may not scale perfectly linearly.
      // Verify actual glyph widths before applying the result to the cells.
      for (let pass = 0; pass < 3; pass++) {
        const actual = measure.measureMany(jobs.map(job => ({ text: job.text, size: job.size })));
        let adjusted = false;
        jobs.forEach((job, index) => {
          if (!(job.available > 0) || actual[index] <= job.available) return;
          job.size = Math.max(.01, Math.floor(job.size * job.available / actual[index] * 100 - 1) / 100);
          adjusted = true;
        });
        if (!adjusted) break;
      }
      jobs.forEach(job => {
        if (job.available > 0) job.cell.style.setProperty('--compound-mobile-money-size', job.size.toFixed(2) + 'px');
      });
    } finally {
      measure.destroy();
    }
  });
}
