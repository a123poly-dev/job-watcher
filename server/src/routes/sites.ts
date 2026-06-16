import { Router } from 'express';
import prisma from '../db';
import { scrapeStatic } from '../scraper/static';
import { scrapeBrowser } from '../scraper/browser';
import { checkSite } from '../checker';

const router = Router();

router.get('/', async (_req, res) => {
  const sites = await prisma.site.findMany({
    where: { archivedAt: null },
    include: {
      filters: {
        where: { archivedAt: null },
        include: { recipient: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sites);
});

router.get('/:id', async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      filters: {
        where: { archivedAt: null },
        include: { recipient: true },
      },
    },
  });
  if (!site) return res.status(404).json({ error: 'Not found' });
  res.json(site);
});

// Preview: try static first, fall back to browser
router.post('/preview', async (req, res) => {
  const { url, listSelector, titleSelector, linkSelector } = req.body;

  try {
    let listings = await scrapeStatic(url, listSelector, titleSelector, linkSelector);
    if (listings.length > 0) {
      return res.json({ listings: listings.slice(0, 20), renderMode: 'static' });
    }

    // Retry with browser
    listings = await scrapeBrowser(url, listSelector, titleSelector, linkSelector);
    return res.json({ listings: listings.slice(0, 20), renderMode: 'browser' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, url, listSelector, titleSelector, linkSelector, renderMode } = req.body;

  const site = await prisma.site.create({
    data: { name, url, listSelector, titleSelector, linkSelector, renderMode: renderMode || 'static' },
  });

  await prisma.activityLogEntry.create({
    data: { type: 'site_added', detail: `Added site "${name}" (${url})` },
  });

  res.json(site);
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, url, listSelector, titleSelector, linkSelector, renderMode, checkIntervalMinutes } = req.body;

  const site = await prisma.site.update({
    where: { id },
    data: { name, url, listSelector, titleSelector, linkSelector, renderMode, checkIntervalMinutes },
  });

  res.json(site);
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return res.status(404).json({ error: 'Not found' });

  await prisma.site.update({ where: { id }, data: { archivedAt: new Date() } });

  await prisma.activityLogEntry.create({
    data: { type: 'site_removed', detail: `Removed site "${site.name}"` },
  });

  res.json({ ok: true });
});

// Trigger an immediate check
router.post('/:id/check', async (req, res) => {
  const id = parseInt(req.params.id);
  checkSite(id).catch(console.error);
  res.json({ ok: true, message: 'Check triggered' });
});

export default router;
