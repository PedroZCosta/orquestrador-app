import { findCoupon } from './coupons.js';

/**
 * Avalia um cupom contra as linhas do pedido.
 *
 * `lines`: [{ sku, quantity, unitPrice, category }]. Devolve
 * `{ ok: true, code, amount, freeShipping }` ou `{ ok: false, code, reason }`,
 * com `reason` em UNKNOWN, EXPIRED, MIN_SUBTOTAL ou NOT_APPLICABLE.
 */
export function evaluateCoupon(code, lines, now) {
  const coupon = findCoupon(code);
  if (coupon === null) {
    return { ok: false, code, reason: 'UNKNOWN' };
  }
  if (coupon.expiresAt !== undefined && now.getTime() > Date.parse(coupon.expiresAt)) {
    return { ok: false, code: coupon.code, reason: 'EXPIRED' };
  }
  const subtotal = lineSubtotal(lines);
  if (coupon.minSubtotal !== undefined && subtotal <= coupon.minSubtotal) {
    return { ok: false, code: coupon.code, reason: 'MIN_SUBTOTAL' };
  }
  switch (coupon.type) {
    case 'percent':
      return percentDiscount(coupon, lines);
    case 'fixed':
      return {
        ok: true,
        code: coupon.code,
        amount: Math.min(coupon.value, subtotal),
        freeShipping: false,
      };
    case 'free_shipping':
      return { ok: true, code: coupon.code, amount: 0, freeShipping: true };
    default:
      throw new Error(`Tipo de cupom desconhecido: ${coupon.type}`);
  }
}

function percentDiscount(coupon, lines) {
  const eligible =
    coupon.category === undefined ? lines : lines.filter((line) => line.category === coupon.category);
  if (eligible.length === 0) {
    return { ok: false, code: coupon.code, reason: 'NOT_APPLICABLE' };
  }
  const base = lineSubtotal(eligible);
  const amount = Math.round(((base * coupon.value) / 100) * 100) / 100;
  return { ok: true, code: coupon.code, amount, freeShipping: false };
}

export function lineSubtotal(lines) {
  const raw = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return Math.round(raw * 100) / 100;
}
