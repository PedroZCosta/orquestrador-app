const LEVELS = ['debug', 'info', 'warn', 'error'];

/**
 * Log estruturado mínimo. `sink` recebe cada registro; o padrão descarta,
 * para os testes não poluírem a saída.
 */
export function createLogger({ level = 'info', sink = () => {} } = {}) {
  const minimum = LEVELS.indexOf(level);
  if (minimum < 0) {
    throw new Error(`Nível de log desconhecido: ${level}`);
  }
  const logger = {};
  for (const [index, name] of LEVELS.entries()) {
    logger[name] = (message, fields = {}) => {
      if (index >= minimum) {
        sink({ level: name, message, ...fields });
      }
    };
  }
  logger.child = (fields) => {
    const child = createLogger({ level, sink: (record) => sink({ ...fields, ...record }) });
    return child;
  };
  return logger;
}

export function createMemoryLogger(level = 'debug') {
  const records = [];
  const logger = createLogger({ level, sink: (record) => records.push(record) });
  logger.records = records;
  return logger;
}
