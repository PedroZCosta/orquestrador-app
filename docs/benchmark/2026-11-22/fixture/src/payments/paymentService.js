import { PAYMENT } from '../config.js';
import { requireOneOf } from '../util/validation.js';

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cobrança com novas tentativas.
 *
 * Tenta até `maxAttempts` vezes enquanto o gateway disser que a falha é
 * temporária (`retryable`), esperando `backoffMs[i]` antes da tentativa i+2.
 * Recusa definitiva (cartão recusado, por exemplo) para na hora.
 */
export class PaymentService {
  constructor({ gateway, maxAttempts = PAYMENT.maxAttempts, backoffMs = PAYMENT.backoffMs, sleep = realSleep, logger }) {
    this.gateway = gateway;
    this.maxAttempts = maxAttempts;
    this.backoffMs = backoffMs;
    this.sleep = sleep;
    this.logger = logger;
  }

  async charge({ orderId, amount, method }) {
    requireOneOf(method, PAYMENT.methods, 'method');
    let lastReason = 'unknown';
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const result = await this.gateway.charge({ orderId, amount, method });
      if (result.ok) {
        this.logger?.info('Pagamento aprovado', { orderId, attempt });
        return { ok: true, paymentId: result.paymentId, attempts: attempt };
      }
      lastReason = result.reason;
      this.logger?.warn('Pagamento falhou', { orderId, attempt, reason: result.reason });
      if (!result.retryable) {
        return { ok: false, reason: result.reason, attempts: attempt };
      }
      if (attempt < this.maxAttempts) {
        const wait = this.backoffMs[attempt - 1] ?? this.backoffMs[this.backoffMs.length - 1] ?? 0;
        await this.sleep(wait);
      }
    }
    return { ok: false, reason: lastReason, attempts: this.maxAttempts };
  }
}
