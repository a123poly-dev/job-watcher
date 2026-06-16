import { chromium } from 'playwright';
import type { Listing } from './static';

export async function scrapeBrowser(
  pageUrl: string,
  listSelector: string,
  titleSelector: string,
  linkSelector: string
): Promise<Listing[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector(listSelector, { timeout: 10000 }).catch(() => {});

    const listings = await page.evaluate(
      ({ listSel, titleSel, linkSel, baseUrl }) => {
        const results: { title: string; url: string }[] = [];
        const items = document.querySelectorAll(listSel);

        items.forEach((el) => {
          const titleEl = titleSel === 'self' ? el : el.querySelector(titleSel);
          const linkEl = linkSel === 'self' ? el : el.querySelector(linkSel);

          const title = titleEl?.textContent?.trim() || '';
          let url = (linkEl as HTMLAnchorElement)?.href || '';

          if (url && !url.startsWith('http')) {
            const base = new URL(baseUrl);
            url = url.startsWith('/') ? `${base.origin}${url}` : `${base.origin}/${url}`;
          }

          if (title) {
            results.push({ title, url: url || baseUrl });
          }
        });

        return results;
      },
      { listSel: listSelector, titleSel: titleSelector, linkSel: linkSelector, baseUrl: pageUrl }
    );

    return listings;
  } finally {
    await browser.close();
  }
}
