import Anthropic from '@anthropic-ai/sdk';
import type { Listing } from './static';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripHtml(html: string): string {
  // Remove scripts, styles, svgs, and excessive whitespace
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 60000); // stay well within context limits
}

export async function extractListingsWithAI(pageUrl: string, html: string): Promise<Listing[]> {
  const text = stripHtml(html);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are extracting job listings from a careers page.

Page URL: ${pageUrl}

Page content:
${text}

Extract all job listings. Return ONLY a JSON array, no other text. Each item must have:
- "title": the job title (string)
- "url": the direct link to that job posting (string, absolute URL)

If the link is relative (starts with /), prepend the origin: ${new URL(pageUrl).origin}
If no direct link exists for a listing, use the page URL.
If there are no job listings at all, return an empty array [].

Return format: [{"title":"...", "url":"..."}, ...]`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Extract JSON even if the model wraps it in markdown
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]) as { title?: string; url?: string }[];
  return parsed
    .filter((item) => item.title && item.title.trim())
    .map((item) => ({ title: item.title!.trim(), url: item.url || pageUrl }));
}
