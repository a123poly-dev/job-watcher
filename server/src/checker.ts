import crypto from 'crypto';
import axios from 'axios';
import type { Browser } from 'playwright';
import prisma from './db';
import { scrapeBrowser } from './scraper/browser';
import { extractListingsHeuristic } from './scraper/heuristic';
import { sendJobAlert } from './mailer';

function fingerprint(title: string, url: string) {
  return crypto.createHash('md5').update(`${title}|${url}`).digest('hex');
}

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

type BrowserProvider = () => Promise<Browser>;

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'media']);

async function fetchPageHtml(browser: Browser, url: string): Promise<string> {
  const page = await browser.newPage();
  try {
    await page.route('**/*', (route) =>
      BLOCKED_RESOURCE_TYPES.has(route.request().resourceType()) ? route.abort() : route.continue()
    );
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    return await page.content();
  } finally {
    await page.close();
  }
}

// Returns a lazy provider that launches Chromium on first use, plus a close()
// that shuts it down only if it was actually launched.
function createLazyBrowser(): { getBrowser: BrowserProvider; close: () => Promise<void> } {
  let browserPromise: Promise<Browser> | undefined;
  return {
    getBrowser: () => {
      if (browserPromise) return browserPromise;
      // A failed launch is not cached, so the next site can retry.
      const launching: Promise<Browser> = launchBrowser().catch((err) => {
        browserPromise = undefined;
        throw err;
      });
      browserPromise = launching;
      return launching;
    },
    close: async () => {
      if (!browserPromise) return;
      const pending = browserPromise;
      browserPromise = undefined;
      await (await pending.catch(() => undefined))?.close();
    },
  };
}

// sharedGetBrowser: passed by runAllChecks so all sites share one lazily-launched
// Chromium. When undefined (single-site check from the API), a private one is used.
async function fetchAndExtract(
  site: { url: string; renderMode: string },
  sharedGetBrowser?: BrowserProvider,
): Promise<ReturnType<typeof extractListingsHeuristic>> {
  let html: string;
  let usedBrowser = site.renderMode === 'browser';
  const ownBrowser = sharedGetBrowser ? undefined : createLazyBrowser();
  const getBrowser = sharedGetBrowser ?? ownBrowser!.getBrowser;

  try {
    if (site.renderMode === 'browser') {
      try {
        html = await fetchPageHtml(await getBrowser(), site.url);
      } catch {
        // Browser crashed — fall back to static fetch
        const { data } = await axios.get(site.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobWatcher/1.0)' },
          timeout: 15000,
        });
        return extractListingsHeuristic(data, site.url);
      }
    } else {
      try {
        const { data } = await axios.get(site.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobWatcher/1.0)' },
          timeout: 15000,
        });
        html = data;

        // Detect client-side SPA shells — jobs won't be in the static HTML
        const isSpaShell = typeof html === 'string' && (
          html.includes('__NEXT_DATA__') ||
          html.includes('data-reactroot') ||
          html.includes('window.__nuxt__') ||
          html.includes('id="__gatsby"')
        );
        if (typeof html !== 'string' || html.length < 1000 || isSpaShell) {
          throw new Error('SPA shell or too short');
        }
      } catch {
        html = await fetchPageHtml(await getBrowser(), site.url);
        usedBrowser = true;
        await prisma.site.updateMany({ where: { url: site.url }, data: { renderMode: 'browser' } });
      }
    }

    const listings = extractListingsHeuristic(html, site.url);

    // If static returned 0, probe with browser once to check for JS-rendered jobs.
    if (listings.length === 0 && !usedBrowser) {
      try {
        const browserHtml = await fetchPageHtml(await getBrowser(), site.url);
        const browserListings = extractListingsHeuristic(browserHtml, site.url);
        if (browserListings.length > 0) {
          await prisma.site.updateMany({ where: { url: site.url }, data: { renderMode: 'browser' } });
          return browserListings;
        }
      } catch { /* probe failed — return 0 */ }
    }

    return listings;
  } finally {
    await ownBrowser?.close();
  }
}

export async function checkSite(siteId: number, sharedGetBrowser?: BrowserProvider) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      filters: {
        where: { isActive: true, archivedAt: null },
        include: { recipient: true },
      },
    },
  });

  if (!site || site.archivedAt) return;

  try {
    const listings = await fetchAndExtract(site, sharedGetBrowser);

    // Filter scraped listings to only those matching active keyword filters.
    // If all filters have blank keywords (= "any"), keep everything.
    const activeKeywords = site.filters
      .filter((f) => f.isActive && f.keyword.trim() !== '')
      .map((f) => f.keyword.trim().toLowerCase());

    const relevantListings = activeKeywords.length === 0
      ? listings
      : listings.filter((l) => activeKeywords.some((kw) => l.title.toLowerCase().includes(kw)));

    if (relevantListings.length === 0) {
      await prisma.site.update({
        where: { id: siteId },
        data: { lastCheckedAt: new Date(), lastStatus: 'no listings' },
      });
      return;
    }

    // First-ever check: mark all existing listings as baseline (they predate our tracking)
    const isFirstCheck = site.lastCheckedAt === null;
    const newListings: typeof listings = [];

    for (const listing of relevantListings) {
      const fp = fingerprint(listing.title, listing.url);
      const existing = await prisma.seenListing.findUnique({
        where: { siteId_fingerprint: { siteId, fingerprint: fp } },
      });

      if (!existing) {
        await prisma.seenListing.create({
          data: { siteId, fingerprint: fp, title: listing.title, url: listing.url, isBaseline: isFirstCheck },
        });
        if (!isFirstCheck) newListings.push(listing);
      }
    }

    for (const listing of newListings) {
      for (const filter of site.filters) {
        const keyword = filter.keyword.trim().toLowerCase();
        const matches = keyword === '' || listing.title.toLowerCase().includes(keyword);

        if (matches) {
          let success = false;
          try {
            await sendJobAlert({
              toEmail: filter.recipient.email,
              siteName: site.name,
              listingTitle: listing.title,
              listingUrl: listing.url,
            });
            success = true;
          } catch (err) {
            console.error(`Email failed for filter ${filter.id}:`, err);
          }

          await prisma.notificationLogEntry.create({
            data: {
              filterId: filter.id,
              listingTitle: listing.title,
              listingUrl: listing.url,
              sentToEmail: filter.recipient.email,
              success,
            },
          });
        }
      }
    }

    await prisma.site.update({
      where: { id: siteId },
      data: { lastCheckedAt: new Date(), lastStatus: `ok: ${relevantListings.length} positions` },
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    await prisma.site.update({
      where: { id: siteId },
      data: { lastCheckedAt: new Date(), lastStatus: `error: ${msg.slice(0, 200)}` },
    });
    console.error(`Error checking site ${siteId}:`, err);
  }
}

export async function runAllChecks() {
  const sites = await prisma.site.findMany({ where: { archivedAt: null } });
  console.log(`[checker] Running checks for ${sites.length} sites`);
  // One Chromium for the whole run, launched only if some site needs it.
  const lazyBrowser = createLazyBrowser();
  try {
    for (const site of sites) {
      await checkSite(site.id, lazyBrowser.getBrowser);
    }
  } finally {
    await lazyBrowser.close();
  }
}
