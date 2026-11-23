// Teste oculto da T1 (cupom com pedido mínimo inclusivo). Roda numa cópia do
// resultado, em test-ocultos/, importando a API pública do projeto.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFixedClock, createStore, evaluateCoupon } from '../src/index.js';

const NOW = new Date('2026-03-10T12:00:00Z');
const adesivos = (quantity) => [{ sku: 'ADE-060', quantity, unitPrice: 12.5, category: 'acessorios', weightKg: 0.05 }];

function store() {
  return createStore({ clock: createFixedClock('2026-03-10T12:00:00.000Z'), sleep: async () => {} });
}

describe('T1 oculto: pedido mínimo do cupom é inclusivo', () => {
  it('pedido de exatamente R$ 100,00 recebe o BEMVINDO10', async () => {
    const order = await store().orders.placeOrder({
      customer: { name: 'Ana', email: 'ana@example.com', state: 'SP' },
      items: [{ sku: 'ADE-060', quantity: 8 }],
      couponCode: 'BEMVINDO10',
    });
    assert.equal(order.totals.subtotal, 100);
    assert.equal(order.totals.discount, 10);
    assert.equal(order.totals.coupon, 'BEMVINDO10');
  });

  it('vale também para os outros cupons com mínimo', () => {
    assert.equal(evaluateCoupon('BEMVINDO10', adesivos(8), NOW).ok, true);
    const desc = evaluateCoupon('DESC50', adesivos(24), NOW);
    assert.equal(desc.ok, true);
    assert.equal(desc.amount, 50);
    const frete = evaluateCoupon('FRETEGRATIS', adesivos(12), NOW);
    assert.equal(frete.ok, true);
    assert.equal(frete.freeShipping, true);
  });

  it('abaixo do mínimo continua recusado', async () => {
    assert.equal(evaluateCoupon('BEMVINDO10', adesivos(7), NOW).reason, 'MIN_SUBTOTAL');
    assert.equal(evaluateCoupon('DESC50', adesivos(23), NOW).reason, 'MIN_SUBTOTAL');
    await assert.rejects(
      async () =>
        store().orders.placeOrder({
          customer: { name: 'Ana', email: 'ana@example.com', state: 'SP' },
          items: [{ sku: 'ADE-060', quantity: 7 }],
          couponCode: 'BEMVINDO10',
        }),
      { code: 'COUPON_REJECTED' },
    );
  });

  it('acima do mínimo segue igual', () => {
    const result = evaluateCoupon('BEMVINDO10', adesivos(9), NOW);
    assert.equal(result.ok, true);
    assert.equal(result.amount, 11.25);
  });
});
