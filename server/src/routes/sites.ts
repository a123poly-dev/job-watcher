import { Router } from 'express';
import axios from 'axios';
import prisma from '../db';
import { extractListingsHeuristic } from '../scraper/heuristic';
import { checkSite } from '../checker';

const router = Router();

async function fetchHtmlBrowser(url: string): Promise<string> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchHtml(url: string): Promise<{ html: string; renderMode: 'static' | 'browser' }> {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobWatcher/1.0)' },
      timeout: 15000,
    });
    if (typeof data === 'string' && data.length > 500) {
      // Detect client-side SPA shells — jobs won't be in the static HTML
      const isSpaShell = data.includes('__NEXT_DATA__') || data.includes('data-reactroot') ||
                         data.includes('window.__nuxt__') || data.includes('id="__gatsby"');
      if (!isSpaShell) {
        return { html: data, renderMode: 'static' };
      }
    }
  } catch { /* fall through to browser */ }

  const html = await fetchHtmlBrowser(url);
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
    let listings = extractListingsHeuristic(html, url);

    // Static fetch returned no listings — JS may be required to render jobs.
    // Try browser mode once to verify, and report the browser result if better.
    if (listings.length === 0 && renderMode === 'static') {
      try {
        const browserHtml = await fetchHtmlBrowser(url);
        const browserListings = extractListingsHeuristic(browserHtml, url);
        if (browserListings.length > 0) {
          return res.json({ listings: browserListings.slice(0, 20), renderMode: 'browser' });
        }
      } catch { /* browser failed — return 0 listings in static mode */ }
    }

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
