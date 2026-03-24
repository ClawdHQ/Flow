import pinoLib from 'pino';

// pino types differ between ESM and CJS — use the module directly
const pino = (typeof pinoLib === 'function' ? pinoLib : (pinoLib as any).default) as typeof pinoLib;

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: process.env['NODE_ENV'] !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
