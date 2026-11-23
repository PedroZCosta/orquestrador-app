/**
 * Erros de domínio. Todo erro esperado do negócio carrega um `code` estável,
 * que quem chama usa para decidir o que fazer (as mensagens podem mudar).
 */
export class DomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message, details = {}) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity, id) {
    super(`${entity.toUpperCase()}_NOT_FOUND`, `${entity} "${id}" não encontrado.`, { id });
    this.name = 'NotFoundError';
  }
}

export function isDomainError(error, code) {
  return error instanceof DomainError && (code === undefined || error.code === code);
}
