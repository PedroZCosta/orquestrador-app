import { STATES } from '../config.js';
import { ValidationError } from '../util/errors.js';

export function taxRateFor(state) {
  const entry = STATES[state];
  if (entry === undefined) {
    throw new ValidationError(`Estado sem alíquota: "${state}".`, { field: 'state' });
  }
  return entry.taxRate;
}

/**
 * Imposto sobre a mercadoria já com desconto. O frete não é tributado.
 */
export function computeTax(taxableAmount, state) {
  const rate = taxRateFor(state);
  return Math.round(taxableAmount * rate * 100) / 100;
}

/** Alíquota como texto para a nota ("18%", "19,5%"). */
export function describeRate(state) {
  const percent = taxRateFor(state) * 100;
  const text = Number.isInteger(percent) ? String(percent) : String(Math.trunc(percent * 10) / 10);
  return `${text.replace('.', ',')}%`;
}
