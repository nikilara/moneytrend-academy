export const MAX_COMPOUND_DAYS = 365;

export function balanceOnDay(initial, rate, day) {
  if (initial === 0 || (rate === -100 && day > 0)) return 0;
  if (day === 0 || rate === 0) return initial;
  const exponent = day * Math.log1p(rate / 100);
  if (Math.abs(exponent) < 0.5) return initial + initial * Math.expm1(exponent);
  const factor = Math.exp(exponent);
  // A factor may overflow/underflow while the scaled balance remains finite.
  if (Number.isFinite(factor) && factor > 0) return initial * factor;
  return Math.exp(Math.log(initial) + exponent);
}

export function calculateCompound(initial, rate, days) {
  if (!Number.isFinite(initial) || initial < 0) {
    throw new RangeError('Введите начальную сумму в долларах: 0 или больше.');
  }
  if (!Number.isInteger(rate) || rate < 1 || rate > 30) {
    throw new RangeError('Введите целый дневной процент от 1% до 30%.');
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_COMPOUND_DAYS) {
    throw new RangeError('Введите целое число дней от 1 до 365.');
  }
  const total = balanceOnDay(initial, rate, days);
  const exponent = days === 0 ? 0 : days * Math.log1p(rate / 100);
  const gain = initial === 0 || days === 0 || rate === 0 ? 0
    : Math.abs(exponent) < 0.5 ? initial * Math.expm1(exponent) : total - initial;
  if (!Number.isFinite(total) || !Number.isFinite(gain)) {
    throw new RangeError('Результат слишком велик для расчёта. Уменьшите сумму, процент или срок.');
  }
  return { initial, rate, days, total, gain };
}
