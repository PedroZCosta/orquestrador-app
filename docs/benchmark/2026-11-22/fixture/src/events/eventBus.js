/**
 * Barramento de eventos síncrono em memória. Um assinante que falha não
 * impede os outros: o erro vai para o log e o evento segue.
 *
 * Eventos de domínio emitidos hoje (veja quem emite em cada módulo):
 * pedidos, pagamentos e estoque.
 */
export class EventBus {
  constructor({ logger } = {}) {
    this.handlers = new Map();
    this.history = [];
    this.logger = logger;
  }

  on(type, handler) {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(
        type,
        current.filter((item) => item !== handler),
      );
    };
  }

  emit(type, payload = {}) {
    const event = { type, payload };
    this.history.push(event);
    for (const handler of [...(this.handlers.get(type) ?? []), ...(this.handlers.get('*') ?? [])]) {
      try {
        handler(payload, event);
      } catch (error) {
        this.logger?.error('Assinante falhou', { type, error: error.message });
      }
    }
    return event;
  }

  emitted(type) {
    return this.history.filter((event) => event.type === type).map((event) => event.payload);
  }
}
