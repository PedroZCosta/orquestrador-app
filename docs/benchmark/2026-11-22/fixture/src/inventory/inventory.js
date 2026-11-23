import { LOW_STOCK_THRESHOLD } from '../config.js';
import { DomainError, NotFoundError } from '../util/errors.js';
import { requirePositiveInt } from '../util/validation.js';

/**
 * Estoque com reservas por pedido.
 *
 * - `onHand`: unidades fisicamente na loja.
 * - `reserved`: unidades separadas para pedidos ainda não pagos.
 * - disponível para venda = onHand - reserved.
 *
 * `reserve` separa as unidades de um pedido; `commit` (pagamento aprovado)
 * tira as unidades do estoque de vez; `release` (pagamento recusado) devolve a
 * reserva ao disponível.
 */
export class Inventory {
  constructor({ stock = {}, bus, threshold = LOW_STOCK_THRESHOLD } = {}) {
    this.items = new Map();
    this.reservations = new Map();
    this.bus = bus;
    this.threshold = threshold;
    for (const [sku, quantity] of Object.entries(stock)) {
      this.items.set(sku, { onHand: quantity, reserved: 0 });
    }
  }

  entry(sku) {
    const item = this.items.get(sku);
    if (item === undefined) {
      throw new NotFoundError('stock', sku);
    }
    return item;
  }

  available(sku) {
    const item = this.entry(sku);
    return item.onHand - item.reserved;
  }

  onHand(sku) {
    return this.entry(sku).onHand;
  }

  addStock(sku, quantity) {
    requirePositiveInt(quantity, 'quantity');
    const item = this.items.get(sku) ?? { onHand: 0, reserved: 0 };
    item.onHand += quantity;
    this.items.set(sku, item);
    return item.onHand;
  }

  /** Reserva todos os itens do pedido, ou nenhum. */
  reserve(orderId, lines) {
    if (this.reservations.has(orderId)) {
      throw new DomainError('ALREADY_RESERVED', `O pedido ${orderId} já tem reserva.`, { orderId });
    }
    const missing = lines.filter((line) => this.available(line.sku) < line.quantity);
    if (missing.length > 0) {
      throw new DomainError('OUT_OF_STOCK', 'Sem estoque para parte dos itens.', {
        skus: missing.map((line) => line.sku),
      });
    }
    for (const line of lines) {
      this.entry(line.sku).reserved += line.quantity;
    }
    this.reservations.set(orderId, lines.map((line) => ({ sku: line.sku, quantity: line.quantity })));
  }

  reservationOf(orderId) {
    return this.reservations.get(orderId) ?? null;
  }

  /** Pagamento aprovado: as unidades reservadas saem do estoque. */
  commit(orderId) {
    const lines = this.takeReservation(orderId);
    for (const line of lines) {
      const item = this.entry(line.sku);
      item.reserved -= line.quantity;
      item.onHand -= line.quantity;
      const available = item.onHand - item.reserved;
      if (available <= this.threshold) {
        this.bus?.emit('stock.low', { sku: line.sku, available });
      }
    }
    return lines;
  }

  /** Reserva desfeita: as unidades voltam a ficar disponíveis. */
  release(orderId) {
    const lines = this.takeReservation(orderId);
    for (const line of lines) {
      this.entry(line.sku).reserved -= line.quantity;
    }
    return lines;
  }

  takeReservation(orderId) {
    const lines = this.reservations.get(orderId);
    if (lines === undefined) {
      throw new DomainError('NO_RESERVATION', `O pedido ${orderId} não tem reserva.`, { orderId });
    }
    this.reservations.delete(orderId);
    return lines;
  }

  snapshot() {
    return Object.fromEntries([...this.items].map(([sku, item]) => [sku, { ...item }]));
  }
}
