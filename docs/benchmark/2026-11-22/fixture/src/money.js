/**
 * Dinheiro em reais, como número com duas casas. Todo valor que sai para o
 * cliente passa por `round2`; a exibição usa `formatBRL` ("R$ 1.234,56").
 */
export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function formatBRL(value) {
  const [integer, decimals] = round2(value).toFixed(2).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${decimals}`;
}

export function sumMoney(values) {
  return round2(values.reduce((total, value) => total + value, 0));
}

export function percentOf(value, percent) {
  return round2((value * percent) / 100);
}

export function isMoney(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
