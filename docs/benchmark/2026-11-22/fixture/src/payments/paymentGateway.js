import { createIdGenerator } from '../util/ids.js';

/**
 * Gateway de pagamento falso, com o mesmo contrato do real:
 *
 * - `charge({ orderId, amount, method })` -> `{ ok: true, paymentId }` ou
 *   `{ ok: false, retryable, reason }`;
 * - `refund({ paymentId, amount })` -> `{ ok: true, refundId }` ou
 *   `{ ok: false, reason }`.
 *
 * `script` permite roteirizar as respostas de `charge` nos testes: cada item é
 * consumido por uma chamada (ex.: `[{ ok: false, retryable: true, reason: 'timeout' }]`).
 * Sem roteiro, toda cobrança é aprovada.
 */
export class FakePaymentGateway {
  constructor({ script = [] } = {}) {
    this.script = [...script];
    this.charges = [];
    this.refunds = [];
    this.nextPaymentId = createIdGenerator('PAY');
    this.nextRefundId = createIdGenerator('REF');
  }

  async charge({ orderId, amount, method }) {
    const scripted = this.script.shift();
    const attempt = { orderId, amount, method };
    this.charges.push(attempt);
    if (scripted !== undefined && !scripted.ok) {
      return { ok: false, retryable: Boolean(scripted.retryable), reason: scripted.reason ?? 'declined' };
    }
    const paymentId = this.nextPaymentId();
    attempt.paymentId = paymentId;
    return { ok: true, paymentId };
  }

  async refund({ paymentId, amount }) {
    const charge = this.charges.find((item) => item.paymentId === paymentId);
    if (charge === undefined) {
      return { ok: false, reason: 'unknown_payment' };
    }
    const alreadyRefunded = this.refunds
      .filter((item) => item.paymentId === paymentId)
      .reduce((sum, item) => sum + item.amount, 0);
    if (alreadyRefunded + amount > charge.amount + 1e-9) {
      return { ok: false, reason: 'amount_exceeds_charge' };
    }
    const refundId = this.nextRefundId();
    this.refunds.push({ paymentId, amount, refundId });
    return { ok: true, refundId };
  }
}
