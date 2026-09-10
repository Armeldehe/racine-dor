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
    // Assigned by a provider bridge (see initClarityBridge() below), if
    // one is registered. Absent by default (e.g. Clarity not loaded on
    // this hostname, blocked by an ad blocker, or never initialized), in
    // which case trackEvent() does nothing beyond the optional debug log.
    __rdAnalyticsSink?: (name: AnalyticsEventName, properties: AnalyticsEventProperties) => void;
    // Defined by the Microsoft Clarity snippet in BaseLayout.astro — a
    // queueing function before the real tag script has loaded, the real
    // API once it has. Never called directly from components; only from
    // initClarityBridge() below.
    clarity?: (...args: unknown[]) => void;
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
 * Bridges trackEvent() to Microsoft Clarity's Custom Events API — the only
 * provider wired in so far. Registers the sink that trackEvent() already
 * calls; no component calls window.clarity directly (UI -> trackEvent ->
 * this bridge -> Clarity).
 *
 * Clarity's API has no per-event properties object, only:
 *   clarity('set', key, value)   — a session-level custom tag
 *   clarity('event', name)       — the named custom event itself
 * so any non-PII context (source/item/item_type/price/recommendation —
 * all already-public product/routine identifiers, never free text) is set
 * as tags immediately before firing the event.
 *
 * Safe by construction: if Clarity never loaded (wrong hostname, ad
 * blocker, script blocked, not yet ready), `window.clarity` is undefined
 * and this sink is simply never called with a working provider — same
 * try/catch-guarded no-op behavior as the rest of trackEvent().
 */
export function initClarityBridge(): void {
  window.__rdAnalyticsSink = (name, properties) => {
    const clarity = window.clarity;
    if (typeof clarity !== 'function') return;
    if (properties.source) clarity('set', 'source', properties.source);
    if (properties.item) clarity('set', 'item', properties.item);
    if (properties.item_type) clarity('set', 'item_type', properties.item_type);
    if (properties.price != null) clarity('set', 'price', String(properties.price));
    if (properties.recommendation) clarity('set', 'recommendation', properties.recommendation);
    clarity('event', name);
  };
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
