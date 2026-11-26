/** One-position budget: a fixed margin loss and an ATR/leverage-dependent profit. */

function percentOf(base, percent) {
  const product = base * percent;
  return Number.isFinite(product) ? product / 100 : (base / 100) * percent;
}

export function calculateFutures(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RangeError('Передайте параметры расчёта фьючерсной позиции.');
  }
  const { deposit, entryPercent, leverage, atrPercent } = input;
  if (!Number.isFinite(deposit) || deposit <= 0) {
    throw new RangeError('Введите положительный размер депозита в долларах.');
  }
  if (!Number.isInteger(entryPercent) || entryPercent < 1 || entryPercent > 5) {
    throw new RangeError('Выберите вход в сделку от 1% до 5% депозита с шагом 1%.');
  }
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 50) {
    throw new RangeError('Выберите кредитное плечо от 1 до 50.');
  }
  if (!Number.isInteger(atrPercent) || atrPercent < 1 || atrPercent > 10) {
    throw new RangeError('Введите целое движение цены от 1% до 10%.');
  }
  const margin = percentOf(deposit, entryPercent);
  if (!(margin > 0)) {
    throw new RangeError('Сумма входа слишком мала для расчёта. Увеличьте депозит.');
  }
  const takePercent = atrPercent * leverage;
  const result = {
    margin,
    stopLoss: margin,
    takeProfit: percentOf(margin, takePercent),
    stopDepositPercent: entryPercent,
    takeDepositPercent: percentOf(entryPercent, takePercent),
    takePercent,
    riskReward: takePercent / 100
  };
  if (!Object.values(result).every(Number.isFinite)) {
    throw new RangeError('Результат слишком велик для расчёта. Уменьшите депозит.');
  }
  return result;
}
