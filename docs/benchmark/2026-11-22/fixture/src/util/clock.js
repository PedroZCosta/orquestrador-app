/**
 * Relógio injetável. O serviço de pedidos nunca chama `new Date()` direto:
 * recebe um relógio, e os testes usam um fixo.
 */
export const systemClock = {
  now() {
    return new Date();
  },
};

export function createFixedClock(iso) {
  let current = new Date(iso);
  return {
    now() {
      return new Date(current.getTime());
    },
    advance(ms) {
      current = new Date(current.getTime() + ms);
    },
    set(nextIso) {
      current = new Date(nextIso);
    },
  };
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
