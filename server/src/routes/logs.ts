import { Router } from 'express';
import prisma from '../db';

const router = Router();

router.get('/activity', async (_req, res) => {
  const entries = await prisma.activityLogEntry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(entries);
});

router.get('/notifications', async (_req, res) => {
  const entries = await prisma.notificationLogEntry.findMany({
    orderBy: { sentAt: 'desc' },
    take: 200,
    include: { filter: { include: { site: true } } },
  });
  res.json(entries);
});

export default router;
