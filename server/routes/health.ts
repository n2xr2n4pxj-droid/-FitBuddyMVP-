/**
 * Health check API - 無需認證
 * GET /api/health
 */

import { Router, Request, Response } from 'express';

const router = Router();

export type HealthResponse = {
  status: 'ok';
  timestamp: string;
};

router.get('/health', (_req: Request, res: Response) => {
  try {
    const payload: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(payload);
  } catch (error) {
    console.error('[health] Error:', error);
    res.status(500).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

export default router;
