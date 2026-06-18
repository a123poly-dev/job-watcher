import crypto from 'crypto';
import axios from 'axios';
import prisma from './db';
import { scrapeBrowser } from './scraper/browser';
import { extractListingsHeuristic } from './scraper/heuristic';
import { sendJobAlert } from './mailer';

function fingerprint(title: string, url: string) {
  return crypto.createHash('md5').update(`${title}|${url}`).digest('hex');
}

async function fetchAndExtract(site: { url: string; renderMode: string }) {
  let html: string;

  if (site.renderMode === 'browser') {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // let JS settle
      // Wait for any client-side data fetches (e.g. Greenhouse widget) to finish
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      html = await page.content();
    } catch {
      // Browser crashed or timed out — fall back to static fetch
      await browser.close();
      const { data } = await axios.get(site.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobWatcher/1.0)' },
        timeout: 15000,
      });
      return extractListingsHeuristic(data, site.url);
    }
    await browser.close();
  } else {
    try {
      const { data } = await axios.get(site.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobWatcher/1.0)' },
        timeout: 15000,
      });
      html = data;

      // If page looks empty/shell or is a client-side SPA, retry with browser
      const isSpaShell = typeof html === 'string' && (
        html.includes('__NEXT_DATA__') ||       // Next.js
        html.includes('data-reactroot') ||       // React
        html.includes('window.__nuxt__') ||      // Nuxt.js
        html.includes('id="__gatsby"')           // Gatsby
      );
      if (typeof html !== 'string' || html.length < 1000 || isSpaShell) {
        throw new Error('Page content too short or SPA shell, likely JS-rendered');
      }
    } catch {
      // Fall back to Playwright
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      const page = await browser.newPage();
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      html = await page.content();
      await browser.close();

      // Remember this site needs browser mode
      await prisma.site.updateMany({
        where: { url: site.url },
        data: { renderMode: 'browser' },
      });
    }
  }

  return extractListingsHeuristic(html, site.url);
}

export async function checkSite(siteId: number) {
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
    const listings = await fetchAndExtract(site);

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
  for (const site of sites) {
    await checkSite(site.id);
  }
}
