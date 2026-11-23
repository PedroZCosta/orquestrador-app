import { TEMPLATES } from './templates.js';

/**
 * Transporte em memória (o de produção envia e-mail). Guarda tudo em `sent`.
 */
export class MemoryTransport {
  constructor() {
    this.sent = [];
  }

  send(message) {
    this.sent.push(message);
  }
}

/**
 * Escuta os eventos de pedido no barramento e manda a mensagem do modelo
 * correspondente ao e-mail do cliente.
 */
export class Notifier {
  constructor({ bus, transport, logger }) {
    this.bus = bus;
    this.transport = transport;
    this.logger = logger;
    this.unsubscribes = [];
  }

  start() {
    for (const type of Object.keys(TEMPLATES)) {
      this.unsubscribes.push(this.bus.on(type, (payload) => this.notify(type, payload)));
    }
    return this;
  }

  stop() {
    for (const unsubscribe of this.unsubscribes.splice(0)) {
      unsubscribe();
    }
  }

  notify(type, payload) {
    if (!payload.email) {
      this.logger?.warn('Evento sem e-mail; nada enviado', { type, orderId: payload.orderId });
      return null;
    }
    const { subject, body } = TEMPLATES[type](payload);
    const message = { to: payload.email, subject, body, type };
    this.transport.send(message);
    return message;
  }
}

/** Alerta interno de estoque baixo, para a equipe de compras. */
export function lowStockAlert({ sku, available }, unitCost) {
  const reposition = Math.max(0, 20 - available);
  const estimate = Math.round(reposition * unitCost * 100) / 100;
  const formatted = `R$ ${estimate.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;
  return `Estoque baixo de ${sku}: ${available} disponíveis. Repor ${reposition} unidades (custo estimado ${formatted}).`;
}
