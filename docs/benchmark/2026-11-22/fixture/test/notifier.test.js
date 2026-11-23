import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lowStockAlert } from '../src/notifications/notifier.js';
import { CUSTOMER, testStore } from './helpers.js';

describe('Notifier', () => {
  it('avisa o cliente na criação, no pagamento e no envio', async () => {
    const store = testStore();
    const order = await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'MON-050', quantity: 1 }] });
    await store.orders.payOrder(order.id, 'pix');
    store.orders.shipOrder(order.id, 'BR999');
    const subjects = store.transport.sent.map((message) => message.subject);
    assert.deepEqual(subjects, ['Pedido ORD-0001 recebido', 'Pedido ORD-0001 confirmado', 'Pedido ORD-0001 enviado']);
    assert.ok(store.transport.sent[0].body.includes('R$ 2.240,82'));
    assert.equal(store.transport.sent[0].to, 'ana@example.com');
  });

  it('alerta de estoque baixo com custo estimado', () => {
    assert.equal(
      lowStockAlert({ sku: 'MON-050', available: 2 }, 1200),
      'Estoque baixo de MON-050: 2 disponíveis. Repor 18 unidades (custo estimado R$ 21.600,00).',
    );
  });
});
