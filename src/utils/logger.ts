import pinoLib from 'pino';

// pino types differ between ESM and CJS — cast to callable
const pino = pinoLib as unknown as typeof pinoLib.default;

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: process.env['NODE_ENV'] !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
