import { defineConfig } from 'astro/config';

export default defineConfig({
  // TODO(production domain): this is the RFC 2606 reserved `.example`
  // placeholder — it can never resolve, so nothing derived from it (the
  // canonical tag, Open Graph/Twitter URLs, robots.txt's Sitemap line,
  // sitemap.xml's <loc> entries, structured data's `url`) is a real,
  // publishable canonical yet. Replace this ONE value with the real
  // production domain before the Cloudflare Pages launch — everything
  // that derives from `site` (see src/layouts/BaseLayout.astro,
  // src/pages/robots.txt.ts, src/pages/sitemap.xml.ts) updates on its own.
  site: 'https://racinedor.example',
  compressHTML: true,
  image: {
    // Default sharp-based build-time image service (AVIF/WebP + responsive srcset).
  },
});
