import { Router } from 'express';
import axios from 'axios';
import prisma from '../db';
import { extractListingsHeuristic } from '../scraper/heuristic';
import { checkSite } from '../checker';

const router = Router();

async function fetchHtml(url: string): Promise<{ html: string; renderMode: 'static' | 'browser' }> {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobWatcher/1.0)' },
      timeout: 15000,
    });
    if (typeof data === 'string' && data.length > 500) {
      return { html: data, renderMode: 'static' };
    }
  } catch { /* fall through to browser */ }

  // Fall back to Playwright for JS-rendered pages
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const html = await page.content();
  await browser.close();
  return { html, renderMode: 'browser' };
}

router.get('/', async (_req, res) => {
  const sites = await prisma.site.findMany({
    where: { archivedAt: null },
    include: {
      filters: { where: { archivedAt: null }, include: { recipient: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sites);
});

router.get('/:id', async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { filters: { where: { archivedAt: null }, include: { recipient: true } } },
  });
  if (!site) return res.status(404).json({ error: 'Not found' });
  res.json(site);
});

router.get('/:id/listings', async (req, res) => {
  const siteId = parseInt(req.params.id);
  const listings = await prisma.seenListing.findMany({
    where: { siteId },
    orderBy: { firstSeenAt: 'desc' },
    take: 100,
  });
  res.json(listings);
});

// Preview: fetch page, extract listings with AI
router.post('/preview', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const { html, renderMode } = await fetchHtml(url);
    const listings = extractListingsHeuristic(html, url);
    res.json({ listings: listings.slice(0, 20), renderMode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, url, renderMode } = req.body;

  const site = await prisma.site.create({
    data: {
      name,
      url,
      listSelector: '',
      titleSelector: '',
      linkSelector: '',
      renderMode: renderMode || 'static',
    },
  });

  await prisma.activityLogEntry.create({
    data: { type: 'site_added', detail: `Added site "${name}" (${url})` },
  });

  res.json(site);
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, url, renderMode, checkIntervalMinutes } = req.body;

  const site = await prisma.site.update({
    where: { id },
    data: { name, url, renderMode, checkIntervalMinutes },
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

router.post('/:id/check', async (req, res) => {
  const id = parseInt(req.params.id);
  checkSite(id).catch(console.error);
  res.json({ ok: true, message: 'Check triggered' });
});

export default router;
