import { Catalog } from './catalog/catalog.js';
import { SEED_STOCK } from './catalog/seed.js';
import { EventBus } from './events/eventBus.js';
import { Inventory } from './inventory/inventory.js';
import { MemoryTransport, Notifier } from './notifications/notifier.js';
import { InMemoryOrderRepository } from './orders/orderRepository.js';
import { OrderService } from './orders/orderService.js';
import { FakePaymentGateway } from './payments/paymentGateway.js';
import { PaymentService } from './payments/paymentService.js';
import { systemClock } from './util/clock.js';
import { createLogger } from './util/logger.js';

export { Catalog } from './catalog/catalog.js';
export { createProduct, CATEGORIES } from './catalog/product.js';
export { Cart } from './cart/cart.js';
export { EventBus } from './events/eventBus.js';
export { Inventory } from './inventory/inventory.js';
export { MemoryTransport, Notifier, lowStockAlert } from './notifications/notifier.js';
export { Order, ORDER_STATUSES } from './orders/order.js';
export { InMemoryOrderRepository } from './orders/orderRepository.js';
export { OrderService } from './orders/orderService.js';
export { FakePaymentGateway } from './payments/paymentGateway.js';
export { PaymentService } from './payments/paymentService.js';
export { computeTotals } from './pricing/pricing.js';
export { evaluateCoupon } from './pricing/discounts.js';
export { computeShipping, deliveryDays } from './pricing/shipping.js';
export { computeTax, describeRate } from './pricing/tax.js';
export { salesReport, formatReport } from './reports/salesReport.js';
export { formatBRL, round2, sumMoney, percentOf } from './money.js';
export { DomainError, ValidationError, NotFoundError, isDomainError } from './util/errors.js';
export { createFixedClock, systemClock } from './util/clock.js';

/**
 * Monta a loja inteira com o catálogo e o estoque iniciais. Tudo pode ser
 * trocado (relógio, gateway, espera entre tentativas) para os testes.
 */
export function createStore({
  clock = systemClock,
  gateway = new FakePaymentGateway(),
  sleep,
  stock = SEED_STOCK,
  logger = createLogger({ level: 'warn' }),
} = {}) {
  const bus = new EventBus({ logger });
  const catalog = Catalog.withSeed();
  const inventory = new Inventory({ stock: { ...stock }, bus });
  const repository = new InMemoryOrderRepository();
  const payments = new PaymentService({ gateway, logger, ...(sleep === undefined ? {} : { sleep }) });
  const transport = new MemoryTransport();
  const notifier = new Notifier({ bus, transport, logger }).start();
  const orders = new OrderService({ catalog, inventory, repository, payments, bus, clock, logger });
  return { bus, catalog, inventory, repository, gateway, payments, transport, notifier, orders, clock };
}
