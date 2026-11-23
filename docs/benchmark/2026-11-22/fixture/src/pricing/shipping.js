import { SHIPPING, STATES } from '../config.js';
import { DomainError, ValidationError } from '../util/errors.js';

export function regionOf(state) {
  const entry = STATES[state];
  if (entry === undefined) {
    throw new ValidationError(`Não entregamos no estado "${state}".`, { field: 'state' });
  }
  return entry.region;
}

export function totalWeight(lines) {
  return lines.reduce((sum, line) => sum + line.weightKg * line.quantity, 0);
}

/**
 * Frete: base da região + adicional por quilo (peso arredondado para cima).
 * Grátis quando o subtotal com desconto chega ao limite de frete grátis ou
 * quando o cupom dá frete grátis.
 */
export function computeShipping({ lines, state, discountedSubtotal, freeShipping = false }) {
  const weight = totalWeight(lines);
  if (weight > SHIPPING.maxWeightKg) {
    throw new DomainError('TOO_HEAVY', `Pedido acima de ${SHIPPING.maxWeightKg} kg.`, { weight });
  }
  if (freeShipping || discountedSubtotal >= SHIPPING.freeShippingThreshold) {
    return 0;
  }
  const region = regionOf(state);
  const billableKg = Math.ceil(weight);
  const raw = SHIPPING.baseByRegion[region] + SHIPPING.perKgByRegion[region] * billableKg;
  return Math.round(raw * 100) / 100;
}

/** Prazo estimado em dias úteis, por região. */
export function deliveryDays(state) {
  const days = { sudeste: 3, sul: 4, 'centro-oeste': 5, nordeste: 7, norte: 9 };
  return days[regionOf(state)];
}
