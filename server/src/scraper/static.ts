import axios from 'axios';
import * as cheerio from 'cheerio';

export interface Listing {
  title: string;
  url: string;
}

export async function scrapeStatic(
  pageUrl: string,
  listSelector: string,
  titleSelector: string,
  linkSelector: string
): Promise<Listing[]> {
  const { data } = await axios.get(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobWatcher/1.0)',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const listings: Listing[] = [];

  $(listSelector).each((_, el) => {
    const titleEl = titleSelector === 'self' ? $(el) : $(el).find(titleSelector);
    const linkEl = linkSelector === 'self' ? $(el) : $(el).find(linkSelector);

    const title = titleEl.text().trim();
    let url = linkEl.attr('href') || '';

    if (url && !url.startsWith('http')) {
      const base = new URL(pageUrl);
      url = url.startsWith('/') ? `${base.origin}${url}` : `${base.origin}/${url}`;
    }

    if (title) {
      listings.push({ title, url: url || pageUrl });
    }
  });

  return listings;
}
