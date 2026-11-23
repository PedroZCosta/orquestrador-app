// Teste oculto da T2 (cancelamento de pedidos). Roda numa cópia do resultado,
// em test-ocultos/, só pela API pública descrita no pedido.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFixedClock, createStore, FakePaymentGateway, ORDER_STATUSES, salesReport } from '../src/index.js';

const CUSTOMER = { name: 'Ana Souza', email: 'ana@example.com', state: 'SP' };

function store(options = {}) {
  return createStore({ clock: createFixedClock('2026-03-10T12:00:00.000Z'), sleep: async () => {}, ...options });
}

describe('T2 oculto: cancelamento de pedidos', () => {
  it('cancelled é um status conhecido', () => {
    assert.ok(ORDER_STATUSES.includes('cancelled'));
  });

  it('pedido pendente: desfaz a reserva, sem estorno', async () => {
    const s = store();
    const order = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'LIV-001', quantity: 2 }] });
    assert.equal(s.inventory.available('LIV-001'), 18);
    s.clock.set('2026-03-11T09:30:00.000Z');
    const result = await s.orders.cancelOrder(order.id, 'cliente desistiu');
    assert.equal(result.id, order.id);
    const saved = s.orders.getOrder(order.id);
    assert.equal(saved.status, 'cancelled');
    assert.equal(saved.cancelReason, 'cliente desistiu');
    assert.equal(saved.cancelledAt, '2026-03-11T09:30:00.000Z');
    assert.equal(saved.history.at(-1).status, 'cancelled');
    assert.equal(s.inventory.available('LIV-001'), 20);
    assert.equal(s.inventory.onHand('LIV-001'), 20);
    assert.equal(s.gateway.refunds.length, 0);
    const events = s.bus.emitted('order.cancelled');
    assert.equal(events.length, 1);
    assert.equal(events[0].orderId, order.id);
    assert.equal(events[0].reason, 'cliente desistiu');
    assert.equal(events[0].refunded, false);
    const message = s.transport.sent.find((item) => item.subject === `Pedido ${order.id} cancelado`);
    assert.ok(message, 'mensagem de cancelamento não enviada');
    assert.equal(message.to, 'ana@example.com');
  });

  it('pedido pago: devolve ao estoque físico e estorna o total uma vez', async () => {
    const s = store();
    const order = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'TEC-040', quantity: 2 }] });
    await s.orders.payOrder(order.id, 'credit_card');
    assert.equal(s.inventory.onHand('TEC-040'), 6);
    await s.orders.cancelOrder(order.id, 'arrependimento');
    assert.equal(s.orders.getOrder(order.id).status, 'cancelled');
    assert.equal(s.inventory.onHand('TEC-040'), 8);
    assert.equal(s.inventory.available('TEC-040'), 8);
    assert.equal(s.gateway.refunds.length, 1);
    assert.equal(s.gateway.refunds[0].paymentId, order.payment.paymentId);
    assert.equal(s.gateway.refunds[0].amount, order.totals.total);
    assert.equal(s.bus.emitted('order.cancelled')[0].refunded, true);

    await assert.rejects(async () => s.orders.cancelOrder(order.id, 'de novo'), { code: 'ORDER_NOT_CANCELLABLE' });
    assert.equal(s.gateway.refunds.length, 1);
  });

  it('enviado, entregue ou com pagamento recusado não cancela', async () => {
    const s = store({
      gateway: new FakePaymentGateway({ script: [{ ok: true }, { ok: false, retryable: false, reason: 'card_declined' }] }),
    });
    const shipped = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'CAN-010', quantity: 1 }] });
    await s.orders.payOrder(shipped.id, 'pix');
    s.orders.shipOrder(shipped.id, 'BR1');
    await assert.rejects(async () => s.orders.cancelOrder(shipped.id, 'x'), { code: 'ORDER_NOT_CANCELLABLE' });
    s.orders.deliverOrder(shipped.id);
    await assert.rejects(async () => s.orders.cancelOrder(shipped.id, 'x'), { code: 'ORDER_NOT_CANCELLABLE' });
    const failed = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'CAN-010', quantity: 1 }] });
    await s.orders.payOrder(failed.id, 'credit_card');
    assert.equal(failed.status, 'payment_failed');
    await assert.rejects(async () => s.orders.cancelOrder(failed.id, 'x'), { code: 'ORDER_NOT_CANCELLABLE' });
  });

  it('valida o motivo e o pedido', async () => {
    const s = store();
    const order = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'CAN-010', quantity: 1 }] });
    await assert.rejects(async () => s.orders.cancelOrder(order.id, ''), { code: 'VALIDATION_ERROR' });
    await assert.rejects(async () => s.orders.cancelOrder(order.id), { code: 'VALIDATION_ERROR' });
    await assert.rejects(async () => s.orders.cancelOrder('ORD-9999', 'x'), { code: 'ORDER_NOT_FOUND' });
    assert.equal(s.orders.getOrder(order.id).status, 'pending');
  });

  it('estorno recusado: REFUND_FAILED e o pedido continua pago', async () => {
    class GatewaySemEstorno extends FakePaymentGateway {
      async refund() {
        return { ok: false, reason: 'gateway_down' };
      }
    }
    const s = store({ gateway: new GatewaySemEstorno() });
    const order = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'MOU-030', quantity: 1 }] });
    await s.orders.payOrder(order.id, 'pix');
    await assert.rejects(async () => s.orders.cancelOrder(order.id, 'x'), { code: 'REFUND_FAILED' });
    assert.equal(s.orders.getOrder(order.id).status, 'paid');
  });

  it('o relatório de vendas ignora os cancelados', async () => {
    const s = store();
    const kept = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'LIV-002', quantity: 1 }] });
    const gone = await s.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'LIV-003', quantity: 1 }] });
    await s.orders.payOrder(gone.id, 'pix');
    await s.orders.cancelOrder(gone.id, 'x');
    const report = salesReport(s.orders.listOrders());
    assert.equal(report.orderCount, 1);
    assert.equal(report.revenue, kept.totals.total);
    assert.equal(report.bySku['LIV-003'], undefined);
  });
});
