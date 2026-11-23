/**
 * Gerador de ids sequenciais legíveis (ORD-0001, PAY-0002...). Determinístico
 * de propósito: os testes e os logs ficam previsíveis.
 */
export function createIdGenerator(prefix, start = 1) {
  let next = start;
  return function nextId() {
    const id = `${prefix}-${String(next).padStart(4, '0')}`;
    next += 1;
    return id;
  };
}
