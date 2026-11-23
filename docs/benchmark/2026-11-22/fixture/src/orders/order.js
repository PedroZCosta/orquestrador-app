import { DomainError } from '../util/errors.js';

export const ORDER_STATUSES = ['pending', 'paid', 'payment_failed', 'shipped', 'delivered'];

/** De cada status, para quais o pedido pode ir. */
const TRANSITIONS = {
  pending: ['paid', 'payment_failed'],
  paid: ['shipped'],
  payment_failed: [],
  shipped: ['delivered'],
  delivered: [],
};

/**
 * Pedido. Guarda o cliente, as linhas com o preço do momento da compra, os
 * totais e o histórico de status.
 */
export class Order {
  constructor({ id, customer, lines, totals, createdAt }) {
    this.id = id;
    this.customer = { ...customer };
    this.lines = lines.map((line) => ({ ...line }));
    this.totals = { ...totals };
    this.status = 'pending';
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
    this.history = [{ status: 'pending', at: createdAt }];
    this.payment = null;
    this.shipment = null;
  }

  canTransitionTo(status) {
    return (TRANSITIONS[this.status] ?? []).includes(status);
  }

  transitionTo(status, at, extra = {}) {
    if (!this.canTransitionTo(status)) {
      throw new DomainError(
        'INVALID_TRANSITION',
        `O pedido ${this.id} não pode passar de ${this.status} para ${status}.`,
        { from: this.status, to: status },
      );
    }
    this.status = status;
    this.updatedAt = at;
    this.history.push({ status, at, ...extra });
  }

  markPaid({ paymentId, method, attempts }, at) {
    this.transitionTo('paid', at);
    this.payment = { paymentId, method, attempts, paidAt: at };
  }

  markPaymentFailed({ reason, attempts }, at) {
    this.transitionTo('payment_failed', at, { reason });
    this.payment = { paymentId: null, attempts, failureReason: reason };
  }

  markShipped(trackingCode, at) {
    this.transitionTo('shipped', at);
    this.shipment = { trackingCode, shippedAt: at, deliveredAt: null };
  }

  markDelivered(at) {
    this.transitionTo('delivered', at);
    this.shipment = { ...this.shipment, deliveredAt: at };
  }

  get itemCount() {
    return this.lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  toJSON() {
    return {
      id: this.id,
      customer: this.customer,
      lines: this.lines,
      totals: this.totals,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      history: this.history,
      payment: this.payment,
      shipment: this.shipment,
    };
  }
}
