import { calculateFutures } from './futures-math.js?v=5';

const byId = id => document.getElementById(id);
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 });
const money = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const scientific = new Intl.NumberFormat('ru-RU', { notation: 'scientific', maximumFractionDigits: 4 });
const formatNumber = value => (Math.abs(value) >= 1e12 ? scientific : number).format(value);
const usd = value => (Math.abs(value) >= 1e12 ? scientific : money).format(value) + ' $';
const pct = value => formatNumber(value) + '%';
const parse = input => {
  const text = input.value.trim().replace('−', '-');
  return /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text) ? Number(text.replace(',', '.')) : NaN;
};
const form = byId('futures-form');
const fields = ['deposit', 'entry', 'leverage', 'atr'].map(name => byId('futures-' + name));
const outputNames = ['margin', 'stop-loss', 'stop-deposit', 'take-profit', 'take-deposit', 'ratio'];

function update() {
  const [deposit, entryPercent, leverage, atrPercent] = fields.map(parse);
  fields.forEach(field => field.removeAttribute('aria-invalid'));
  let result;
  try {
    const invalid = [!(deposit > 0), !(Number.isInteger(entryPercent) && entryPercent >= 1 && entryPercent <= 5), !(Number.isInteger(leverage) && leverage >= 1 && leverage <= 50), !(Number.isInteger(atrPercent) && atrPercent >= 1 && atrPercent <= 10)];
    fields.forEach((field, i) => { if (invalid[i] || !Number.isFinite(parse(field))) field.setAttribute('aria-invalid', 'true'); });
    result = calculateFutures({ deposit, entryPercent, leverage, atrPercent });
  } catch (error) {
    byId('futures-error').textContent = error.message;
  }
  byId('futures-error').hidden = Boolean(result);
  if (!result) {
    outputNames.forEach(name => { byId('futures-' + name).textContent = '—'; });
    byId('futures-take-label').textContent = 'Цель по прибыли';
    return;
  }
  byId('futures-margin').textContent = usd(result.margin);
  byId('futures-stop-loss').textContent = '−' + usd(result.stopLoss);
  byId('futures-stop-deposit').textContent = '−' + pct(result.stopDepositPercent) + ' от депозита';
  byId('futures-take-label').textContent = 'Цель по прибыли';
  byId('futures-take-profit').textContent = '+' + usd(result.takeProfit);
  byId('futures-take-deposit').textContent = '+' + pct(result.takeDepositPercent) + ' к депозиту';
  byId('futures-ratio').textContent = '1:' + formatNumber(result.riskReward);
}

for (const [name, maximum] of [['entry', 5], ['leverage', 50], ['atr', 10]]) {
  const input = byId('futures-' + name);
  const range = byId('futures-' + name + '-range');
  input.addEventListener('input', () => {
    const value = parse(input);
    if (Number.isFinite(value)) {
      const integer = Math.round(value);
      if (value !== integer) input.value = String(integer);
      if (integer >= 1 && integer <= maximum) range.value = String(integer);
    }
  });
  range.addEventListener('input', () => {
    const integer = Math.round(Number(range.value));
    input.value = String(integer);
    range.value = String(integer);
    update();
  });
}
fields.forEach(field => field.addEventListener('input', update));
form.addEventListener('submit', event => event.preventDefault());
update();
