/**
 * Cupons vigentes. Tipos:
 * - `percent`: `value`% sobre o subtotal (ou só sobre os itens da `category`);
 * - `fixed`: `value` reais de desconto, limitado ao subtotal;
 * - `free_shipping`: zera o frete.
 *
 * `minSubtotal`: o cupom vale para pedidos a partir desse subtotal (inclusive).
 * `expiresAt`: último instante de validade (ISO); ausente, não expira.
 */
export const COUPONS = {
  BEMVINDO10: {
    type: 'percent',
    value: 10,
    minSubtotal: 100,
    description: '10% de desconto para pedidos a partir de R$ 100,00',
  },
  LIVROS15: {
    type: 'percent',
    value: 15,
    category: 'livros',
    description: '15% de desconto nos livros',
  },
  DESC50: {
    type: 'fixed',
    value: 50,
    minSubtotal: 300,
    description: 'R$ 50,00 de desconto em pedidos a partir de R$ 300,00',
  },
  FRETEGRATIS: {
    type: 'free_shipping',
    minSubtotal: 150,
    description: 'Frete grátis a partir de R$ 150,00',
  },
  NATAL25: {
    type: 'percent',
    value: 25,
    expiresAt: '2025-12-26T02:59:59.999Z',
    description: '25% no Natal de 2025',
  },
};

export function findCoupon(code) {
  if (typeof code !== 'string') {
    return null;
  }
  const key = code.trim().toUpperCase();
  return Object.hasOwn(COUPONS, key) ? { code: key, ...COUPONS[key] } : null;
}
