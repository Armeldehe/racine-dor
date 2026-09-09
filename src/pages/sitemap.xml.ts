import type { APIRoute } from 'astro';

// Phase 9.2 §14 — hand-written static sitemap rather than a dependency:
// the site has exactly one indexable page today, so a build-time
// generator would be overhead for a single <url> entry. /qa/* routes are
// intentionally excluded (noindex/nofollow, robots.txt-disallowed).
const PUBLIC_PATHS = ['/'];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://racinedor.example');
  const urls = PUBLIC_PATHS.map((path) => `  <url><loc>${new URL(path, base).toString()}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
