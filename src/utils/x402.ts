import type express from 'express';
import { config } from '../config/index.js';

export function requireX402(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const secret = config.FLOW_X402_SHARED_SECRET;
  if (!secret) {
    next();
    return;
  }

  const provided = req.headers['x-flow-payment-token'];
  if (provided === secret) {
    next();
    return;
  }

  res.status(402).json({
    error: 'Payment required',
    protocol: 'x402',
    message: 'Provide x-flow-payment-token to access agent skill actions.',
  });
}
