import * as cheerio from 'cheerio';
import type { Listing } from './static';

// Words that mark navigation/utility links — not job titles
const NAV_WORDS = new Set([
  'home', 'about', 'contact', 'login', 'sign in', 'sign up', 'register',
  'privacy', 'terms', 'cookies', 'blog', 'news', 'press', 'investors',
  'careers', 'jobs', 'open positions', 'all jobs', 'view all', 'see all',
  'back', 'next', 'previous', 'load more', 'show more', 'apply now',
  'linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'glassdoor',
  'english', 'suomi', 'svenska', 'deutsch', 'français',
]);

function isNavText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (NAV_WORDS.has(lower)) return true;
  if (lower.length < 4 || lower.length > 120) return true;
  return false;
}

function normaliseUrl(href: string, pageUrl: string): string {
  if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('javascript:')) return '';
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return '';
  }
}

function urlPathPrefix(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    // Return first 2 path segments as the "cluster key"
    return parts.slice(0, 2).join('/');
  } catch {
    return '';
  }
}

export function extractListingsHeuristic(html: string, pageUrl: string): Listing[] {
  const $ = cheerio.load(html);

  // Remove noise elements
  $('header, footer, nav, .nav, .navbar, .menu, .header, .footer, script, style, noscript').remove();

  const pageOrigin = new URL(pageUrl).origin;
  const candidates: Listing[] = [];

  $('a[href]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const href = $(el).attr('href') || '';
    const url = normaliseUrl(href, pageUrl);

    if (!url) return;
    if (isNavText(text)) return;

    // Only follow same-origin links (job listings stay on the company site)
    try {
      if (new URL(url).origin !== pageOrigin) return;
    } catch { return; }

    candidates.push({ title: text, url });
  });

  if (candidates.length === 0) return [];

  // Group by URL path prefix — job listings share a common path pattern
  const groups = new Map<string, Listing[]>();
  for (const c of candidates) {
    const key = urlPathPrefix(c.url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  // Pick the largest group that has ≥ 2 entries (a single link is probably not a list)
  let best: Listing[] = [];
  for (const group of groups.values()) {
    if (group.length > best.length && group.length >= 2) best = group;
  }

  // If no group has ≥ 2, return all candidates (small company, maybe 1 opening)
  if (best.length === 0) best = candidates;

  // Deduplicate by URL
  const seen = new Set<string>();
  return best.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}
