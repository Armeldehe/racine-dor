import type { APIRoute } from 'astro';

// Phase 9.2 §12 — homepage is indexable, /qa/* (technical validation
// routes, already noindex/nofollow individually) is disallowed here too
// as a second, crawler-level layer. Sitemap line is derived from
// astro.config.mjs's `site` (the official production domain).
export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL('sitemap.xml', site ?? 'https://racinedor.ci').toString();
  const body = `User-agent: *\nAllow: /\nDisallow: /qa/\n\nSitemap: ${sitemapUrl}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
