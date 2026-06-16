import crypto from 'crypto';
import prisma from './db';
import { scrapeStatic } from './scraper/static';
import { scrapeBrowser } from './scraper/browser';
import { sendJobAlert } from './mailer';

function fingerprint(title: string, url: string) {
  return crypto.createHash('md5').update(`${title}|${url}`).digest('hex');
}

export async function checkSite(siteId: number) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { filters: { where: { isActive: true, archivedAt: null }, include: { recipient: true } } },
  });

  if (!site || site.archivedAt) return;

  try {
    let listings =
      site.renderMode === 'browser'
        ? await scrapeBrowser(site.url, site.listSelector, site.titleSelector, site.linkSelector)
        : await scrapeStatic(site.url, site.listSelector, site.titleSelector, site.linkSelector);

    if (listings.length === 0) {
      await prisma.site.update({
        where: { id: siteId },
        data: { lastCheckedAt: new Date(), lastStatus: 'error: selectors matched 0 elements' },
      });
      return;
    }

    const newListings: typeof listings = [];

    for (const listing of listings) {
      const fp = fingerprint(listing.title, listing.url);
      const existing = await prisma.seenListing.findUnique({
        where: { siteId_fingerprint: { siteId, fingerprint: fp } },
      });

      if (!existing) {
        await prisma.seenListing.create({
          data: { siteId, fingerprint: fp, title: listing.title, url: listing.url },
        });
        newListings.push(listing);
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
      data: { lastCheckedAt: new Date(), lastStatus: 'ok' },
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
