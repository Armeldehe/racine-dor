/**
 * Phase 9.3 — centralized, privacy-friendly analytics abstraction.
 *
 * Every tracked event in the codebase goes through trackEvent(); nothing
 * else calls a provider SDK directly (there is no provider wired in yet —
 * see astro.config.mjs / BaseLayout.astro for Cloudflare Web Analytics
 * status). trackEvent() is safe to call unconditionally: it never throws,
 * is never awaited, and never delays navigation — call it and move on,
 * including immediately before a WhatsApp link's own default navigation.
 *
 * No PII ever belongs in a properties object: no names, no phone numbers,
 * no WhatsApp message text, no Finder free-text answers. Only the fixed
 * vocabulary below.
 */

export type AnalyticsEventName = 'whatsapp_click' | 'finder_start' | 'finder_complete' | 'routine_view';

export type ItemType = 'product' | 'kit' | 'generic';

export interface AnalyticsEventProperties {
  source?: string;
  item?: string;
  item_type?: ItemType;
  price?: number;
  recommendation?: string;
}

declare global {
  interface Window {
    // Assigned by a future analytics provider's own bootstrap script, if
    // one is ever deliberately added (see Phase 9.3 report §23 — not
    // implemented now). Absent by default, in which case trackEvent()
    // does nothing beyond the optional debug log below.
    __rdAnalyticsSink?: (name: AnalyticsEventName, properties: AnalyticsEventProperties) => void;
  }
}

function debugEnabled(): boolean {
  try {
    return window.localStorage.getItem('rd-analytics-debug') === '1';
  } catch {
    return false;
  }
}

export function trackEvent(name: AnalyticsEventName, properties: AnalyticsEventProperties = {}): void {
  try {
    if (debugEnabled()) {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', name, properties);
    }
    window.__rdAnalyticsSink?.(name, properties);
  } catch {
    // Analytics must never break the site.
  }
}

/**
 * Single delegated click listener for every WhatsApp link on the page —
 * static (Header, Sérum, Beurre, kit cards, Final CTA) and dynamic (the
 * shared floating bar, the Finder result) alike. Each anchor just carries
 * data-track-* attributes (same pattern as the existing data-cta-label /
 * data-cta-message contract); nothing here reaches into component markup
 * or blocks the link's own default navigation.
 */
export function initWhatsAppClickTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest<HTMLAnchorElement>('a[data-track-source]');
    if (!link) return;
    const price = link.dataset.trackPrice ? Number(link.dataset.trackPrice) : undefined;
    trackEvent('whatsapp_click', {
      source: link.dataset.trackSource,
      item: link.dataset.trackItem,
      item_type: (link.dataset.trackItemType as ItemType | undefined) ?? 'generic',
      price,
    });
  });
}
