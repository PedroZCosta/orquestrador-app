import { NotFoundError } from '../util/errors.js';

/** Repositório de pedidos em memória. */
export class InMemoryOrderRepository {
  constructor() {
    this.orders = new Map();
  }

  save(order) {
    this.orders.set(order.id, order);
    return order;
  }

  get(id) {
    const order = this.orders.get(id);
    if (order === undefined) {
      throw new NotFoundError('order', id);
    }
    return order;
  }

  find(id) {
    return this.orders.get(id) ?? null;
  }

  list({ status, email, state } = {}) {
    return [...this.orders.values()]
      .filter((order) => (status === undefined ? true : order.status === status))
      .filter((order) => (email === undefined ? true : order.customer.email === email.toLowerCase()))
      .filter((order) => (state === undefined ? true : order.customer.state === state))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  count() {
    return this.orders.size;
  }
}
