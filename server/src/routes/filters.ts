import { Router } from 'express';
import prisma from '../db';

const router = Router();

router.post('/', async (req, res) => {
  const { siteId, keyword, recipientId } = req.body;

  const [site, recipient] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId } }),
    prisma.recipient.findUnique({ where: { id: recipientId } }),
  ]);

  if (!site || !recipient) return res.status(400).json({ error: 'Invalid siteId or recipientId' });

  // Duplicate check: same keyword (case-insensitive) + same recipient on this site
  const duplicate = await prisma.filter.findFirst({
    where: {
      siteId,
      recipientId,
      archivedAt: null,
      keyword: keyword.trim().toLowerCase(),
    },
  });
  if (duplicate) {
    return res.status(409).json({ error: `"${keyword || 'any'}" is already set for ${recipient.email} on this site` });
  }

  const filter = await prisma.filter.create({
    data: { siteId, keyword, recipientId },
    include: { recipient: true },
  });

  await prisma.activityLogEntry.create({
    data: {
      type: 'filter_added',
      detail: `Added filter "${keyword || '(any)'}" on "${site.name}" → ${recipient.email}`,
    },
  });

  res.json(filter);
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { keyword, recipientId, isActive } = req.body;

  const old = await prisma.filter.findUnique({ where: { id }, include: { site: true, recipient: true } });
  if (!old) return res.status(404).json({ error: 'Not found' });

  const filter = await prisma.filter.update({
    where: { id },
    data: { keyword, recipientId, isActive },
    include: { recipient: true },
  });

  await prisma.activityLogEntry.create({
    data: {
      type: 'filter_edited',
      detail: `Edited filter on "${old.site.name}": keyword="${keyword ?? old.keyword}", active=${isActive ?? old.isActive}`,
    },
  });

  res.json(filter);
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const filter = await prisma.filter.findUnique({ where: { id }, include: { site: true, recipient: true } });
  if (!filter) return res.status(404).json({ error: 'Not found' });

  await prisma.filter.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } });

  await prisma.activityLogEntry.create({
    data: {
      type: 'filter_removed',
      detail: `Removed filter "${filter.keyword || '(any)'}" on "${filter.site.name}"`,
    },
  });

  res.json({ ok: true });
});

export default router;
