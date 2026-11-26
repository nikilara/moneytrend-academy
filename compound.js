import { calculateCompound, balanceOnDay } from './compound-math.js?v=3';
import { CHART_BOUNDS, createChartScale, chartPoint, createChartMilestones } from './compound-chart-math.js?v=6';
import { boundsForLabels, packLabelPositions } from './compound-label-layout.js?v=1';
import { compactMoneyText, createTextMeasurer, fitMobileTable } from './compound-mobile-fit.js?v=1';

const byId = id => document.getElementById(id);
const inputs = ['compound-initial', 'compound-rate', 'compound-days'].map(byId);
const rateUp = byId('compound-rate-up');
const rateDown = byId('compound-rate-down');
const defaultValues = Object.freeze([100, 1, 30]);
const usdFormat = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const largeUsdFormat = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol',
  notation: 'scientific', maximumFractionDigits: 4
});
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumSignificantDigits: 12 });
const scientificNumberFormat = new Intl.NumberFormat('ru-RU', { notation: 'scientific', maximumSignificantDigits: 8 });
const readableNumber = value => (value !== 0 && Math.abs(value) < 1e-6 || Math.abs(value) >= 1e12 ? scientificNumberFormat : numberFormat).format(value);
const dayFormat = new Intl.PluralRules('ru-RU');
const usd = value => (Math.abs(value) >= 1e15 ? largeUsdFormat : usdFormat).format(Math.abs(value) < 0.005 ? 0 : value);
const signedUsd = value => (value >= 0.005 ? '+' : '') + usd(value);
const daysText = days => `${days} ${ { one: 'день', few: 'дня', many: 'дней', other: 'дня' }[dayFormat.select(days)] }`;
const isMobileCompound = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(max-width:700px)').matches;
let current = null;
let milestones = [];
let milestoneButtons = [];
let milestoneMarkers = [];
let pinnedDay = null;
let plotBounds = CHART_BOUNDS;

function parseDecimal(input) {
  const value = input.value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) return NaN;
  return Number(value.replace(',', '.'));
}

function normalizeRateInput(commit = false) {
  const input = inputs[1];
  const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : parseDecimal(input);
  if (Number.isFinite(value)) input.value = String(Math.max(1, Math.min(30, Math.round(value))));
  else if (commit) input.value = String(defaultValues[1]);
}

function showMilestone(day, pin = false) {
  const point = milestones.find(item => item.day === day);
  if (!point) return;
  if (pin) pinnedDay = day;
  const selection = byId('compound-chart-selection');
  if (selection) {
    selection.hidden = false;
    selection.textContent = `День ${point.day} — ${usd(point.balance)}`;
    selection.setAttribute('data-day', String(point.day));
  }
  milestoneButtons.forEach(({ day: buttonDay, button }) => {
    const active = buttonDay === day;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
  });
  milestoneMarkers.forEach(({ day: markerDay, marker }) => {
    marker.setAttribute('r', markerDay === day ? '5' : '3.5');
    marker.classList.toggle('is-active', markerDay === day);
  });
  byId('compound-chart-dot').setAttribute('cx', point.x.toFixed(2));
  byId('compound-chart-dot').setAttribute('cy', point.y.toFixed(2));
}

function restoreMilestone() {
  if (pinnedDay !== null) showMilestone(pinnedDay);
}

function svgLine(attributes, className) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', className);
  Object.entries(attributes).forEach(([name, value]) => line.setAttribute(name, String(value)));
  return line;
}

function updateChartAxes(state, scale) {
  const axis = byId('compound-chart-y-axis');
  const grid = byId('compound-chart-grid');
  if (axis) axis.replaceChildren();
  if (grid) grid.replaceChildren();
  const step = scale.ticks[0].value - scale.ticks[1].value;
  const digits = step > 0 ? Math.max(0, Math.min(6, -Math.floor(Math.log10(step)) + 1)) : 2;
  const formatTick = value => {
    const magnitude = Math.abs(value);
    const scientific = magnitude > 0 && (magnitude >= 1e5 || magnitude < 0.001);
    return new Intl.NumberFormat('ru-RU', scientific
      ? { notation: 'scientific', maximumSignificantDigits: 3 }
      : { maximumFractionDigits: digits }).format(value) + ' $';
  };
  scale.ticks.forEach(({ value, y }) => {
    if (axis) {
      const label = document.createElement('span');
      label.className = 'compound-chart-y-tick';
      label.textContent = formatTick(value);
      label.setAttribute('aria-label', usd(value));
      label.style.top = (y / CHART_BOUNDS.viewHeight * 100) + '%';
      axis.append(label);
    }
    if (grid && y !== CHART_BOUNDS.bottom && typeof document.createElementNS === 'function') {
      grid.append(svgLine({ x1: plotBounds.left, x2: plotBounds.right, y1: y, y2: y,
        stroke: '#c6dcff26', 'stroke-width': 1, 'stroke-dasharray': '3 5' }, 'compound-chart-grid-line'));
    }
  });
  if (grid && typeof document.createElementNS === 'function') {
    grid.append(
      svgLine({ x1: plotBounds.left, x2: plotBounds.left, y1: CHART_BOUNDS.top, y2: CHART_BOUNDS.bottom,
        stroke: '#c6dcff66', 'stroke-width': 1 }, 'compound-chart-axis-line'),
      svgLine({ x1: plotBounds.left, x2: plotBounds.right, y1: CHART_BOUNDS.bottom, y2: CHART_BOUNDS.bottom,
        stroke: '#c6dcff66', 'stroke-width': 1 }, 'compound-chart-axis-line')
    );
  }
}

function prepareMilestoneLabels(state) {
  const container = byId('compound-chart-milestones');
  const chart = byId('compound-chart');
  const points = createChartMilestones(state);
  milestoneButtons = [];
  if (!container) return { chartWidth: 600, chartOffset: 0, containerWidth: 600, maxLabelWidth: 100 };
  container.replaceChildren();
  container.setAttribute('role', 'group');
  points.forEach(point => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'compound-milestone';
    button.setAttribute('data-day', String(point.day));
    button.setAttribute('aria-label', `День ${point.day}: ${usd(point.balance)}`);
    button.setAttribute('aria-pressed', 'false');
    const label = document.createElement('span');
    label.className = 'compound-milestone-day';
    label.textContent = `День ${point.day}`;
    const amount = document.createElement('span');
    amount.className = 'compound-milestone-amount';
    const fullAmount = usd(point.balance);
    amount.textContent = isMobileCompound() ? compactMoneyText(fullAmount) : fullAmount;
    if (isMobileCompound()) amount.title = fullAmount;
    button.append(label, amount);
    button.addEventListener('pointerenter', () => showMilestone(point.day));
    button.addEventListener('pointerleave', restoreMilestone);
    button.addEventListener('focus', () => showMilestone(point.day));
    button.addEventListener('blur', restoreMilestone);
    button.addEventListener('click', () => showMilestone(point.day, true));
    milestoneButtons.push({ day: point.day, button });
    container.append(button);
  });
  const chartRect = chart.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const chartWidth = chartRect.width || 600;
  const containerWidth = containerRect.width || chartWidth + 82;
  const chartOffset = chartRect.width && containerRect.width ? chartRect.left - containerRect.left : 82;
  const maxWidth = Math.min(140, containerWidth - 4);
  if (isMobileCompound()) {
    return prepareMobileLabelGeometry(state, { chartWidth, chartOffset, containerWidth, maxWidth });
  }
  const metrics = milestoneButtons.map(({ button }) => {
    button.style.maxWidth = maxWidth + 'px';
    const normalRect = button.getBoundingClientRect();
    // Selected text is slightly heavier. Reserve its larger footprint before
    // placing any label, so hover/focus cannot push a neighbor or edge outside.
    button.classList.toggle('is-active', true);
    const activeRect = button.getBoundingClientRect();
    button.classList.toggle('is-active', false);
    const fallbackWidth = Math.min(maxWidth, Math.max(...Array.from(button.children, child => child.textContent.length)) * 8 + 8);
    return { width: Math.min(maxWidth, Math.max(normalRect.width, activeRect.width) || fallbackWidth),
      height: Math.max(normalRect.height, activeRect.height) || 52 };
  });
  return { chartWidth, chartOffset, containerWidth, metrics,
    maxLabelWidth: Math.max(...metrics.map(item => item.width)) };
}

function prepareMobileLabelGeometry(state, geometry) {
  const { chartWidth, chartOffset, containerWidth, maxWidth } = geometry;
  const measurer = createTextMeasurer(milestoneButtons[0].button);
  const preferredSize = parseFloat(getComputedStyle(milestoneButtons[0].button).fontSize) || 10;
  const textPairs = milestoneButtons.map(({ button }) => Array.from(button.children, child => child.textContent));
  function measureAt(size) {
    const widths = measurer.measureMany(textPairs.flatMap(texts => texts.map(text => ({ text, size, weight: 600 }))));
    return textPairs.map((texts, index) => {
      const naturalWidth = Math.max(...widths.slice(index * 2, index * 2 + texts.length));
      const fittedSize = Math.min(size, size * Math.max(1, maxWidth - 4) / Math.max(1, naturalWidth));
      const width = Math.min(maxWidth, Math.ceil(naturalWidth * fittedSize / size) + 3);
      return { width, size: fittedSize };
    });
  }
  function rowCount(metrics) {
    const bounds = boundsForLabels(CHART_BOUNDS, { chartWidth, chartOffset, containerWidth,
      maxLabelWidth: Math.max(...metrics.map(item => item.width)) });
    const items = createChartMilestones(state, bounds).map((point, index) => ({
      centerX: chartOffset + point.x / CHART_BOUNDS.viewWidth * chartWidth,
      width: metrics[index].width, height: 44
    }));
    return packLabelPositions(items, containerWidth, 4).rows;
  }
  let size = preferredSize;
  let metrics = measureAt(size);
  // Keep the approved standard four checkpoints on one lane. Longer values for
  // other periods keep a readable size and use separate non-overlapping lanes.
  if (state.days === 30) {
    while (rowCount(metrics) > 1 && size > 6.5) {
      size = Math.max(6.5, size - .25);
      metrics = measureAt(size);
    }
  }
  metrics.forEach((item, index) => {
    const button = milestoneButtons[index].button;
    button.style.setProperty('--compound-mobile-label-size', item.size + 'px');
    button.style.width = item.width + 'px';
    button.style.maxWidth = maxWidth + 'px';
    item.height = Math.max(44, button.getBoundingClientRect().height);
  });
  measurer.destroy();
  return { chartWidth, chartOffset, containerWidth, metrics, mobile: true,
    maxLabelWidth: Math.max(...metrics.map(item => item.width)) };
}

function updateMilestones(state, labelGeometry, previousDay = null) {
  milestones = createChartMilestones(state, plotBounds);
  milestoneMarkers = [];
  pinnedDay = milestones.some(point => point.day === previousDay) ? previousDay : milestones.at(-1).day;
  const container = byId('compound-chart-milestones');
  if (container) {
    const items = milestones.map((point, index) => ({ day: point.day,
      centerX: labelGeometry.chartOffset + point.x / CHART_BOUNDS.viewWidth * labelGeometry.chartWidth,
      ...labelGeometry.metrics[index] }));
    const layout = packLabelPositions(items, labelGeometry.containerWidth, labelGeometry.mobile ? 4 : 8);
    layout.positions.forEach((position, index) => {
      const button = milestoneButtons[index].button;
      button.style.left = position.centerX + 'px';
      button.style.top = position.top + 'px';
      button.setAttribute('data-label-row', String(position.row));
    });
    container.style.height = layout.totalHeight + 'px';
  }
  const markers = byId('compound-chart-markers');
  if (markers) {
    markers.replaceChildren();
    markers.setAttribute('aria-hidden', 'true');
    if (typeof document.createElementNS === 'function') {
      milestones.forEach(point => {
        const guide = svgLine({ x1: point.x.toFixed(2), x2: point.x.toFixed(2),
          y1: point.y.toFixed(2), y2: CHART_BOUNDS.bottom,
          stroke: '#c6dcff33', 'stroke-dasharray': '3 5' }, 'compound-chart-guide');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        marker.setAttribute('class', 'compound-chart-marker');
        marker.setAttribute('cx', point.x.toFixed(2));
        marker.setAttribute('cy', point.y.toFixed(2));
        marker.setAttribute('r', '3.5');
        marker.setAttribute('fill', '#bdff66');
        marker.setAttribute('data-day', String(point.day));
        markers.append(guide, marker);
        milestoneMarkers.push({ day: point.day, marker });
      });
    }
  }
  showMilestone(pinnedDay);
}

function clearMilestones() {
  milestones = [];
  milestoneButtons = [];
  milestoneMarkers = [];
  pinnedDay = null;
  byId('compound-chart-markers')?.replaceChildren();
  byId('compound-chart-milestones')?.replaceChildren();
  const container = byId('compound-chart-milestones');
  if (container) container.style.height = '0px';
  byId('compound-chart-y-axis')?.replaceChildren();
  byId('compound-chart-grid')?.replaceChildren();
  const selection = byId('compound-chart-selection');
  if (selection) {
    selection.textContent = '';
    selection.removeAttribute('data-day');
    selection.hidden = true;
  }
}

function selectChartPoint(event, pin = false) {
  if (!milestones.length || !Number.isFinite(event.clientX)) return;
  const chart = byId('compound-chart');
  if (typeof chart.getBoundingClientRect !== 'function') return;
  const bounds = chart.getBoundingClientRect();
  if (!bounds.width) return;
  const x = Math.max(0, Math.min(CHART_BOUNDS.viewWidth,
    (event.clientX - bounds.left) / bounds.width * CHART_BOUNDS.viewWidth));
  const nearest = milestones.reduce((best, point) =>
    Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best);
  showMilestone(nearest.day, pin);
}

function updateChart(state, preserveSelection = false) {
  const previousDay = preserveSelection ? pinnedDay : null;
  const geometry = prepareMilestoneLabels(state);
  plotBounds = boundsForLabels(CHART_BOUNDS, geometry);
  const count = Math.max(1, Math.min(state.days, 180));
  const scale = createChartScale(state);
  const { left, right, bottom } = plotBounds;
  const sampleDays = new Set(createChartMilestones(state, plotBounds).map(point => point.day));
  for (let i = 0; i <= count; i++) sampleDays.add(Math.round(state.days * i / count));
  const points = [...sampleDays].sort((a, b) => a - b).map(day => {
    const point = chartPoint(state, day, scale, plotBounds);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  });
  const line = 'M' + points.join(' L');
  byId('compound-chart-line').setAttribute('d', line);
  byId('compound-chart-area').setAttribute('d', state.days === 0 ? '' : line + ` L${right},${bottom} L${left},${bottom} Z`);
  const end = points.at(-1).split(',');
  byId('compound-chart-dot').setAttribute('cx', end[0]);
  byId('compound-chart-dot').setAttribute('cy', end[1]);
  byId('compound-chart-title').textContent = `Расчёт суммы: от ${usd(state.initial)} до ${usd(state.total)} за ${daysText(state.days)}.`;
  byId('compound-chart-caption').textContent = daysText(state.days);
  updateChartAxes(state, scale);
  updateMilestones(state, geometry, previousDay);
}

function updateTable() {
  const tbody = byId('compound-rows');
  tbody.replaceChildren();
  if (!current || !byId('compound-breakdown').open) return;
  const fragment = document.createDocumentFragment();
  if (current.days === 0) {
    const row = document.createElement('tr');
    ['0', usd(current.initial), usd(0), usd(current.initial)].forEach(text => {
      const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
    });
    fragment.append(row);
  }
  for (let day = 1; day <= current.days; day++) {
    const start = balanceOnDay(current.initial, current.rate, day - 1);
    const end = balanceOnDay(current.initial, current.rate, day);
    const row = document.createElement('tr');
    [String(day), usd(start), signedUsd(start * (current.rate / 100)), usd(end)].forEach(text => {
      const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
    });
    fragment.append(row);
  }
  tbody.append(fragment);
  if (isMobileCompound()) fitMobileTable(byId('compound-breakdown').querySelector('table'));
}

function updateCompound() {
  const values = inputs.map(parseDecimal);
  inputs.forEach(input => input.removeAttribute('aria-invalid'));
  let error = '';
  try {
    inputs.forEach((input, i) => {
      if (!Number.isFinite(values[i])) {
        input.setAttribute('aria-invalid', 'true');
        if (i === 1) throw new RangeError('Введите целый дневной процент от 1% до 30%.');
        throw new RangeError(`Заполните поле «${input.labels[0].textContent}» числом. Для дробных значений можно использовать точку или запятую.`);
      }
    });
    if (values[0] < 0) inputs[0].setAttribute('aria-invalid', 'true');
    if (!Number.isInteger(values[1]) || values[1] < 1 || values[1] > 30) inputs[1].setAttribute('aria-invalid', 'true');
    if (!Number.isInteger(values[2]) || values[2] < 1 || values[2] > 365) inputs[2].setAttribute('aria-invalid', 'true');
    current = calculateCompound(...values);
  } catch (e) {
    current = null;
    error = e.message;
  }
  byId('compound-error').hidden = !error;
  byId('compound-error').textContent = error;
  byId('compound-chart-wrap').hidden = !current;
  byId('compound-breakdown').hidden = !current;
  byId('compound-formula').hidden = !current;
  byId('compound-total').textContent = current ? usd(current.total) : '—';
  byId('compound-result-caption').textContent = current ? 'Результат за ' + daysText(current.days) : 'Результат по расчёту';
  if (rateUp) rateUp.disabled = values[1] >= 30;
  if (rateDown) rateDown.disabled = values[1] <= 1;
  if (current) {
    byId('compound-formula').textContent = `${usd(current.initial)} × (1 + ${readableNumber(current.rate)} / 100)^${current.days} = ${usd(current.total)}`;
    updateChart(current);
  } else clearMilestones();
  updateTable();
}

inputs.forEach((input, index) => input.addEventListener('input', () => {
  if (index === 1) normalizeRateInput();
  updateCompound();
}));
['change', 'blur'].forEach(type => inputs[1].addEventListener(type, () => {
  normalizeRateInput(true);
  updateCompound();
}));
[[rateUp, 1], [rateDown, -1]].forEach(([button, delta]) => button?.addEventListener('click', () => {
  normalizeRateInput(true);
  inputs[1].value = String(Math.max(1, Math.min(30, Number(inputs[1].value) + delta)));
  updateCompound();
}));
byId('compound-form').addEventListener('submit', event => event.preventDefault());
byId('compound-breakdown').addEventListener('toggle', updateTable);
byId('compound-chart').addEventListener('pointermove', event => {
  if (event.pointerType !== 'touch') selectChartPoint(event);
});
byId('compound-chart').addEventListener('pointerleave', restoreMilestone);
byId('compound-chart').addEventListener('click', event => selectChartPoint(event, true));
function resetCompound() {
  defaultValues.forEach((value, i) => { inputs[i].value = String(value); });
  updateCompound();
}
byId('compound-reset').addEventListener('click', resetCompound);
resetCompound();
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', event => {
    if (event.persisted) resetCompound();
  });
}

let refreshQueued = false;
function refreshChartLayout() {
  if (refreshQueued) return;
  refreshQueued = true;
  const run = () => {
    refreshQueued = false;
    if (current) updateChart(current, true);
    if (byId('compound-breakdown').open) updateTable();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else run();
}
if (typeof ResizeObserver === 'function') {
  let lastWidth = -1;
  new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width ?? byId('compound-chart').getBoundingClientRect().width;
    if (Math.abs(width - lastWidth) > 0.5) {
      lastWidth = width;
      refreshChartLayout();
    }
  }).observe(byId('compound-chart'));
} else if (typeof window !== 'undefined') window.addEventListener('resize', refreshChartLayout);
if (document.fonts) document.fonts.ready.then(refreshChartLayout);
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mobileQuery = window.matchMedia('(max-width:700px)');
  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', refreshChartLayout);
  else if (typeof mobileQuery.addListener === 'function') mobileQuery.addListener(refreshChartLayout);
}
