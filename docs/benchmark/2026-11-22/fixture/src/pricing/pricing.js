import { DomainError } from '../util/errors.js';
import { evaluateCoupon, lineSubtotal } from './discounts.js';
import { computeShipping } from './shipping.js';
import { computeTax } from './tax.js';

/**
 * Total do pedido, nesta ordem:
 * 1. subtotal dos itens;
 * 2. desconto do cupom (sobre o subtotal);
 * 3. frete, calculado sobre o subtotal já com desconto;
 * 4. imposto do estado sobre o subtotal com desconto (o frete não é tributado);
 * 5. total = subtotal com desconto + imposto + frete.
 *
 * `products`: Map sku -> produto. `items`: [{ sku, quantity }].
 * Um cupom informado e recusado lança `COUPON_REJECTED` com o motivo.
 */
export function computeTotals({ items, products, state, couponCode, now = new Date() }) {
  const lines = items.map(({ sku, quantity }) => {
    const product = products.get(sku);
    return {
      sku,
      quantity,
      unitPrice: product.price,
      weightKg: product.weightKg,
      category: product.category,
    };
  });

  const subtotal = lineSubtotal(lines);
  let discount = 0;
  let freeShipping = false;
  let coupon = null;
  if (couponCode !== undefined && couponCode !== null && couponCode !== '') {
    const result = evaluateCoupon(couponCode, lines, now);
    if (!result.ok) {
      throw new DomainError('COUPON_REJECTED', `Cupom ${result.code} recusado (${result.reason}).`, {
        coupon: result.code,
        reason: result.reason,
      });
    }
    discount = result.amount;
    freeShipping = result.freeShipping;
    coupon = result.code;
  }

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
  const shipping = computeShipping({ lines, state, discountedSubtotal, freeShipping });
  const tax = computeTax(discountedSubtotal, state);
  const total = Math.round((discountedSubtotal + tax + shipping) * 100) / 100;

  return {
    lines: lines.map((line) => ({
      ...line,
      lineTotal: Math.round(line.unitPrice * line.quantity * 100) / 100,
    })),
    subtotal,
    discount,
    coupon,
    discountedSubtotal,
    shipping,
    tax,
    total,
  };
}
