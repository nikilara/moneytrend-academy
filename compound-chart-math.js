import { balanceOnDay } from './compound-math.js';

export const CHART_BOUNDS = Object.freeze({
  left: 12, right: 588, top: 6, bottom: 144, flatY: 75,
  viewWidth: 600, viewHeight: 150
});

/** Four checkpoints across the selected period, with the approved 30-day layout. */
export function milestoneDays(days) {
  if (!Number.isInteger(days) || days < 0) {
    throw new RangeError('Срок графика должен быть целым неотрицательным числом.');
  }
  if (days === 0) return [0];
  if (days === 30) return [7, 14, 21, 30];
  const count = Math.min(4, days);
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? days : Math.ceil(days * (i + 1) / count));
}

/** Three readable dollar levels, including zero, without changing any balances. */
export function createChartScale(state) {
  const maximum = Math.max(state.initial, state.total);
  const limit = maximum || 1;
  let high = limit;
  let middle = high / 2;
  const unit = 10 ** Math.floor(Math.log10(high / 2));
  for (const factor of [1, 2, 2.5, 5, 10, 20]) {
    const step = factor * unit;
    const upper = step * 2;
    if (step > 0 && Number.isFinite(upper) && upper >= limit) {
      middle = step;
      high = upper;
      break;
    }
  }
  // Subnormal values can lose their half; two minimum units still form three
  // distinct labels. At the other extreme, the original finite maximum is safe.
  if (!(middle > 0)) {
    middle = high;
    high *= 2;
  }
  const ticks = [high, middle, 0].map(value => {
    const y = CHART_BOUNDS.bottom - value / high * (CHART_BOUNDS.bottom - CHART_BOUNDS.top);
    return { value, y };
  });
  return { low: 0, high, range: high, ticks };
}

/** One coordinate system for the line, markers, guides and amount labels. */
export function chartPoint(state, day, scale = createChartScale(state), bounds = CHART_BOUNDS) {
  const { left, right, top, bottom, flatY } = bounds;
  const balance = balanceOnDay(state.initial, state.rate, day);
  const x = state.days === 0 ? left : left + (right - left) * day / state.days;
  const y = scale.range === 0 ? flatY : bottom - (balance - scale.low) / scale.range * (bottom - top);
  return { day, balance, x, y: Math.max(top, Math.min(bottom, y)) };
}

/** Share the existing compound formula and chart bounds with every visible point. */
export function createChartMilestones(state, bounds = CHART_BOUNDS) {
  const scale = createChartScale(state);
  return milestoneDays(state.days).map(day => {
    return chartPoint(state, day, scale, bounds);
  });
}
