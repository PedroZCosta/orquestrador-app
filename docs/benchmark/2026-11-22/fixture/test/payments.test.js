import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FakePaymentGateway } from '../src/payments/paymentGateway.js';
import { PaymentService } from '../src/payments/paymentService.js';

function service(script) {
  const waits = [];
  const gateway = new FakePaymentGateway({ script });
  const payments = new PaymentService({ gateway, sleep: async (ms) => waits.push(ms) });
  return { gateway, payments, waits };
}

describe('PaymentService', () => {
  it('aprova de primeira', async () => {
    const { payments } = service([]);
    const result = await payments.charge({ orderId: 'ORD-1', amount: 10, method: 'pix' });
    assert.deepEqual(result, { ok: true, paymentId: 'PAY-0001', attempts: 1 });
  });

  it('tenta de novo nas falhas temporárias, com espera crescente', async () => {
    const { payments, waits } = service([
      { ok: false, retryable: true, reason: 'timeout' },
      { ok: false, retryable: true, reason: 'timeout' },
    ]);
    const result = await payments.charge({ orderId: 'ORD-1', amount: 10, method: 'credit_card' });
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 3);
    assert.deepEqual(waits, [200, 400]);
  });

  it('desiste depois do máximo de tentativas', async () => {
    const { payments, gateway } = service([
      { ok: false, retryable: true, reason: 'timeout' },
      { ok: false, retryable: true, reason: 'timeout' },
      { ok: false, retryable: true, reason: 'timeout' },
    ]);
    const result = await payments.charge({ orderId: 'ORD-1', amount: 10, method: 'credit_card' });
    assert.deepEqual(result, { ok: false, reason: 'timeout', attempts: 3 });
    assert.equal(gateway.charges.length, 3);
  });

  it('recusa definitiva não tenta de novo', async () => {
    const { payments, waits } = service([{ ok: false, retryable: false, reason: 'card_declined' }]);
    const result = await payments.charge({ orderId: 'ORD-1', amount: 10, method: 'credit_card' });
    assert.deepEqual(result, { ok: false, reason: 'card_declined', attempts: 1 });
    assert.deepEqual(waits, []);
  });

  it('recusa meio de pagamento desconhecido', async () => {
    const { payments } = service([]);
    await assert.rejects(payments.charge({ orderId: 'ORD-1', amount: 10, method: 'cheque' }), {
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('FakePaymentGateway.refund', () => {
  it('estorna até o valor cobrado', async () => {
    const gateway = new FakePaymentGateway();
    const { paymentId } = await gateway.charge({ orderId: 'ORD-1', amount: 100, method: 'pix' });
    assert.deepEqual(await gateway.refund({ paymentId, amount: 60 }), { ok: true, refundId: 'REF-0001' });
    assert.deepEqual(await gateway.refund({ paymentId, amount: 60 }), { ok: false, reason: 'amount_exceeds_charge' });
  });
});
