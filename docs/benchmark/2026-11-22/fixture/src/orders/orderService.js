import { DomainError } from '../util/errors.js';
import { createIdGenerator } from '../util/ids.js';
import { requireString, validateCustomer, validateItems } from '../util/validation.js';
import { computeTotals } from '../pricing/pricing.js';
import { Order } from './order.js';

/**
 * Coordena o ciclo de vida do pedido: criação (com reserva de estoque),
 * pagamento, envio e entrega. Cada passo grava o pedido e emite um evento no
 * barramento.
 */
export class OrderService {
  constructor({ catalog, inventory, repository, payments, bus, clock, nextOrderId, logger }) {
    this.catalog = catalog;
    this.inventory = inventory;
    this.repository = repository;
    this.payments = payments;
    this.bus = bus;
    this.clock = clock;
    this.nextOrderId = nextOrderId ?? createIdGenerator('ORD');
    this.logger = logger;
  }

  now() {
    return this.clock.now();
  }

  async placeOrder({ customer, items, couponCode }) {
    const buyer = validateCustomer(customer);
    const wanted = validateItems(items);
    const products = new Map(wanted.map(({ sku }) => [sku, this.catalog.getSellable(sku)]));

    const now = this.now();
    const totals = computeTotals({ items: wanted, products, state: buyer.state, couponCode, now });

    const id = this.nextOrderId();
    this.inventory.reserve(id, wanted);

    const order = new Order({
      id,
      customer: buyer,
      lines: totals.lines.map((line) => ({
        sku: line.sku,
        name: products.get(line.sku).name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        coupon: totals.coupon,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
      },
      createdAt: now.toISOString(),
    });
    this.repository.save(order);
    this.logger?.info('Pedido criado', { orderId: id, total: totals.total });
    this.bus.emit('order.placed', {
      orderId: id,
      email: buyer.email,
      name: buyer.name,
      total: totals.total,
    });
    return order;
  }

  getOrder(orderId) {
    return this.repository.get(orderId);
  }

  listOrders(filter) {
    return this.repository.list(filter);
  }

  async payOrder(orderId, method) {
    const order = this.repository.get(orderId);
    if (order.status !== 'pending') {
      throw new DomainError('ORDER_NOT_PAYABLE', `O pedido ${orderId} está ${order.status}.`, {
        status: order.status,
      });
    }
    const result = await this.payments.charge({ orderId, amount: order.totals.total, method });
    const at = this.now().toISOString();
    if (result.ok) {
      order.markPaid({ paymentId: result.paymentId, method, attempts: result.attempts }, at);
      this.inventory.commit(orderId);
      this.repository.save(order);
      this.bus.emit('order.paid', {
        orderId,
        email: order.customer.email,
        name: order.customer.name,
        total: order.totals.total,
        paymentId: result.paymentId,
      });
      return order;
    }
    order.markPaymentFailed({ reason: result.reason, attempts: result.attempts }, at);
    this.inventory.release(orderId);
    this.repository.save(order);
    this.bus.emit('payment.failed', {
      orderId,
      email: order.customer.email,
      name: order.customer.name,
      reason: result.reason,
      attempts: result.attempts,
    });
    return order;
  }

  shipOrder(orderId, trackingCode) {
    const order = this.repository.get(orderId);
    const code = requireString(trackingCode, 'trackingCode').toUpperCase();
    order.markShipped(code, this.now().toISOString());
    this.repository.save(order);
    this.bus.emit('order.shipped', {
      orderId,
      email: order.customer.email,
      name: order.customer.name,
      trackingCode: code,
    });
    return order;
  }

  deliverOrder(orderId) {
    const order = this.repository.get(orderId);
    order.markDelivered(this.now().toISOString());
    this.repository.save(order);
    this.bus.emit('order.delivered', {
      orderId,
      email: order.customer.email,
      name: order.customer.name,
    });
    return order;
  }
}
