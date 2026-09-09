import { defineConfig } from 'astro/config';

export default defineConfig({
  // Official production domain. Single source of truth for every absolute
  // URL the site emits (canonical tag, Open Graph/Twitter URLs, robots.txt's
  // Sitemap line, sitemap.xml's <loc> entries, structured data's `url`) —
  // see src/layouts/BaseLayout.astro, src/pages/robots.txt.ts,
  // src/pages/sitemap.xml.ts. www.racinedor.ci 301-redirects here at the
  // Cloudflare level; this bare domain is the only canonical form.
  site: 'https://racinedor.ci',
  // Production hotfix — made explicit (this was already the default) after
  // the deployed Worker was found serving runtime `/_image?...` URLs that
  // 404 on Cloudflare's static-assets Worker. A clean local `npm run build`
  // from this exact config already produces zero `/_image` references (every
  // <Image>/<Picture> is pre-rendered to a real hashed file in dist/_astro/
  // at build time) — `/_image` is only ever emitted when `output` is
  // 'server'/'hybrid', which this project has never used. Spelling it out
  // removes any ambiguity for whatever built the currently-deployed Worker.
  output: 'static',
  compressHTML: true,
  image: {
    // Default sharp-based build-time image service (AVIF/WebP + responsive srcset).
  },
});
