import crypto from 'crypto';
import { Router } from 'express';
import { runAllChecks } from '../checker';

const router = Router();

let isRunning = false;

function isAuthorized(header: string | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

router.post('/run', (req, res) => {
  if (!isAuthorized(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isRunning) {
    return res.status(409).json({ error: 'Check run already in progress' });
  }

  isRunning = true;
  res.status(202).json({ ok: true, message: 'Check run started' });

  runAllChecks()
    .catch((err) => console.error('[cron] Check run failed:', err))
    .finally(() => { isRunning = false; });
});

export default router;
