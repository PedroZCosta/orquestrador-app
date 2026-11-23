import { createFixedClock, createStore } from '../src/index.js';

export const CUSTOMER = { name: 'Ana Souza', email: 'ana@example.com', state: 'SP' };

/** Loja de teste: relógio fixo e sem espera real entre tentativas de cobrança. */
export function testStore(options = {}) {
  const waits = [];
  const store = createStore({
    clock: createFixedClock('2026-03-10T12:00:00.000Z'),
    sleep: async (ms) => {
      waits.push(ms);
    },
    ...options,
  });
  return { ...store, waits };
}
