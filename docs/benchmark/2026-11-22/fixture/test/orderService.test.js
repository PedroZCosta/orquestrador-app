import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FakePaymentGateway } from '../src/index.js';
import { CUSTOMER, testStore } from './helpers.js';

describe('OrderService', () => {
  it('cria o pedido pendente, reserva o estoque e emite order.placed', async () => {
    const store = testStore();
    const order = await store.orders.placeOrder({
      customer: CUSTOMER,
      items: [
        { sku: 'liv-001', quantity: 1 },
        { sku: 'LIV-001', quantity: 1 },
        { sku: 'CAN-010', quantity: 1 },
      ],
    });
    assert.equal(order.id, 'ORD-0001');
    assert.equal(order.status, 'pending');
    assert.equal(order.lines.length, 2);
    assert.equal(store.inventory.available('LIV-001'), 18);
    assert.equal(store.bus.emitted('order.placed').length, 1);
    assert.equal(order.createdAt, '2026-03-10T12:00:00.000Z');
  });

  it('valida cliente e itens', async () => {
    const store = testStore();
    await assert.rejects(
      store.orders.placeOrder({ customer: { ...CUSTOMER, state: 'XX' }, items: [{ sku: 'LIV-001', quantity: 1 }] }),
      { code: 'VALIDATION_ERROR' },
    );
    await assert.rejects(store.orders.placeOrder({ customer: CUSTOMER, items: [] }), { code: 'VALIDATION_ERROR' });
    await assert.rejects(
      store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'MON-050', quantity: 4 }] }),
      { code: 'OUT_OF_STOCK' },
    );
  });

  it('pagamento aprovado: paid, estoque baixado e order.paid', async () => {
    const store = testStore();
    const order = await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'TEC-040', quantity: 2 }] });
    await store.orders.payOrder(order.id, 'credit_card');
    assert.equal(order.status, 'paid');
    assert.equal(order.payment.paymentId, 'PAY-0001');
    assert.equal(store.inventory.onHand('TEC-040'), 6);
    assert.equal(store.bus.emitted('order.paid').length, 1);
  });

  it('pagamento recusado: payment_failed e reserva liberada', async () => {
    const gateway = new FakePaymentGateway({ script: [{ ok: false, retryable: false, reason: 'card_declined' }] });
    const store = testStore({ gateway });
    const order = await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'MOU-030', quantity: 1 }] });
    await store.orders.payOrder(order.id, 'credit_card');
    assert.equal(order.status, 'payment_failed');
    assert.equal(store.inventory.available('MOU-030'), 15);
    assert.deepEqual(store.bus.emitted('payment.failed')[0].reason, 'card_declined');
  });

  it('envio e entrega seguem a ordem dos status', async () => {
    const store = testStore();
    const order = await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'CAM-020', quantity: 1 }] });
    assert.throws(() => store.orders.shipOrder(order.id, 'br123'), { code: 'INVALID_TRANSITION' });
    await store.orders.payOrder(order.id, 'pix');
    store.orders.shipOrder(order.id, 'br123');
    store.orders.deliverOrder(order.id);
    assert.equal(order.status, 'delivered');
    assert.equal(order.shipment.trackingCode, 'BR123');
    assert.deepEqual(
      order.history.map((entry) => entry.status),
      ['pending', 'paid', 'shipped', 'delivered'],
    );
  });

  it('pedido inexistente', () => {
    const store = testStore();
    assert.throws(() => store.orders.getOrder('ORD-9999'), { code: 'ORDER_NOT_FOUND' });
  });
});
