import * as cheerio from 'cheerio';
import type { Listing } from './static';

// ─── Blocked domains ────────────────────────────────────────────────────────
// Social / noise domains that are never job postings
const BLOCKED_DOMAINS = new Set([
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'youtube.com', 'glassdoor.com', 'indeed.com', 'google.com', 'apple.com',
  'tiktok.com', 'snapchat.com', 'pinterest.com', 'xing.com', 'kununu.com',
]);

function isBlockedDomain(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '');
  return BLOCKED_DOMAINS.has(h) || [...BLOCKED_DOMAINS].some((d) => h.endsWith('.' + d));
}

// ─── Known job platform hostnames ───────────────────────────────────────────
// These are third-party ATS platforms. Links to these are likely job postings.
const JOB_PLATFORM_PATTERNS = [
  'teamtailor.com',
  'greenhouse.io',
  'lever.co',
  'workable.com',
  'breezy.hr',
  'ashbyhq.com',
  'personio.com',
  'recruitee.com',
  'jobvite.com',
  'smartrecruiters.com',
  'bamboohr.com',
  'workday.com',
  'myworkdayjobs.com',
  'oracle.com',
  'taleo.net',
];

function isJobPlatform(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '');
  return JOB_PLATFORM_PATTERNS.some((p) => h === p || h.endsWith('.' + p));
}

// ─── Nav text filter ─────────────────────────────────────────────────────────
// Link text that indicates navigation / categories, not job titles
const NAV_WORDS = new Set([
  'home', 'about', 'contact', 'login', 'sign in', 'sign up', 'register',
  'privacy', 'terms', 'cookies', 'blog', 'news', 'press', 'investors',
  'careers', 'jobs', 'open positions', 'all jobs', 'all positions', 'view all',
  'see all', 'back', 'next', 'previous', 'load more', 'show more', 'apply now',
  'view open positions', 'open roles', 'all roles', 'see open positions',
  'linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'glassdoor',
  'english', 'suomi', 'svenska', 'deutsch', 'français',
  'helsinki', 'espoo', 'tampere', 'finland', 'remote', 'hybrid',
  // Single-word department names that appear as category links
  'sales', 'marketing', 'product', 'engineering', 'design', 'finance', 'legal',
  'operations', 'hr', 'people', 'devops', 'it', 'security', 'support', 'research',
]);

function isNavText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (NAV_WORDS.has(lower)) return true;
  if (lower.length < 5 || lower.length > 120) return true;
  return false;
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

function normaliseUrl(href: string, pageUrl: string): string {
  if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('javascript:')) return '';
  try {
    const u = new URL(href, pageUrl);
    u.hash = ''; // strip fragment — /jobs#helsinki → /jobs
    return u.href;
  } catch {
    return '';
  }
}

function pathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

// ─── Job link qualification ───────────────────────────────────────────────────
//
// Rules for deciding whether a link points to an individual job posting:
//
// SAME-ORIGIN links:
//   ✓ Must be deeper in path than the source careers page
//     e.g. source=/careers  link=/careers/123-designer  → depth 2 > 1 ✓
//     e.g. source=/careers  link=/about                 → depth 1 = 1 ✗
//
// EXTERNAL links on known job platforms (Teamtailor, Greenhouse, etc.):
//   ✓ Must have path depth ≥ 2
//   ✓ Path must contain a digit — job postings always have a numeric ID or UUID
//     e.g. teamtailor.com/jobs/7811787-designer  → digit ✓
//     e.g. teamtailor.com/jobs/sales             → no digit ✗  (department page)
//
// EXTERNAL links on unknown domains:
//   ✗ Skip — we don't know what they link to
//
function isJobLink(url: string, pageUrl: string): boolean {
  try {
    const u = new URL(url);
    const pageHost = new URL(pageUrl).hostname;
    const isSameOrigin = u.hostname === pageHost;

    if (isSameOrigin) {
      return pathDepth(url) > pathDepth(pageUrl);
    }

    if (isJobPlatform(u.hostname)) {
      return pathDepth(url) >= 2 && /\d/.test(u.pathname);
    }

    return false;
  } catch {
    return false;
  }
}

// ─── Main extractor ──────────────────────────────────────────────────────────

export function extractListingsHeuristic(html: string, pageUrl: string): Listing[] {
  const $ = cheerio.load(html);

  // Remove structural chrome
  $('header, footer, nav, .nav, .navbar, .navigation, .menu, .header, .footer, script, style, noscript, [role="navigation"], [role="banner"]').remove();

  const pageNorm = normaliseUrl(pageUrl, pageUrl);
  const seen = new Set<string>();
  const results: Listing[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const url = normaliseUrl(href, pageUrl);

    if (!url) return;
    if (url === pageNorm) return;
    if (seen.has(url)) return;

    try {
      if (isBlockedDomain(new URL(url).hostname)) return;
    } catch { return; }

    if (!isJobLink(url, pageUrl)) return;

    // Get title from link text.
    // Some sites use an empty overlay <a> that covers the whole card (Webflow, etc.)
    // In that case climb up to find the nearest container with meaningful text.
    let text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length < 5) {
      let parent = $(el).parent();
      for (let i = 0; i < 4; i++) {
        const candidate = parent.clone().find('a').remove().end().text().replace(/\s+/g, ' ').trim();
        if (candidate.length >= 5 && candidate.length <= 120) { text = candidate; break; }
        parent = parent.parent();
      }
    }

    if (isNavText(text)) return;

    seen.add(url);
    results.push({ title: text, url });
  });

  return results;
}
