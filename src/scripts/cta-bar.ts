import { DEFAULT_CTA_LABEL, buildWhatsAppLink, greetingFor } from '../config/site';
import type { ItemType } from './analytics';

type Mode = 'hidden' | 'compact' | 'contextual';

interface Track {
  source?: string;
  item?: string;
  itemType?: ItemType;
  price?: number;
}

// The bar's default when no dominant section (or override) says otherwise
// — a distinct, honest "clicked the persistent bar, not a specific
// product section" bucket, never a stale leftover from whichever section
// was dominant before.
const GENERIC_TRACK: Track = { source: 'floating_bar', item: 'generic', itemType: 'generic' };

/**
 * Drives the single persistent WhatsApp bar. Exactly one instance exists
 * on the page (see WhatsAppBar.astro) — sections never render their own
 * WhatsApp buttons, they only declare what the shared bar should say.
 *
 * data-cta-label   -> text shown while this section dominates the viewport
 * data-cta-message -> WhatsApp message to prefill (defaults to the label)
 * data-cta-mode    -> "hidden" | "compact" | "contextual" (default: contextual)
 *   hidden     - cinematic finale, its own CTA already exists on screen
 *   compact    - cinematic / interstitial scenes: icon only, unobtrusive
 *   contextual - commercial scenes: full pill with product + price
 */
export function initCtaBar(): void {
  const bar = document.querySelector<HTMLElement>('[data-cta-bar]');
  const label = document.querySelector<HTMLElement>('[data-cta-bar-label]');
  const link = document.querySelector<HTMLAnchorElement>('[data-cta-bar-link]');
  if (!bar || !label || !link) return;

  function setState(text: string, message: string, mode: Mode, track: Track = GENERIC_TRACK): void {
    if (!bar || !label || !link) return;
    label.textContent = text;
    link.href = buildWhatsAppLink(message);
    const hidden = mode === 'hidden';
    bar.classList.toggle('wa-bar--hidden', hidden);
    bar.classList.toggle('wa-bar--compact', mode === 'compact');
    // Phase 9.2 a11y fix: opacity:0 + pointer-events:none only hid the bar
    // visually — its link stayed keyboard-focusable and screen-reader
    // announced. `inert` removes it from both the tab order and the
    // accessibility tree while hidden, and both attributes lift the
    // instant the bar becomes visible again, restoring normal focus/AT
    // behavior with no change to its look.
    bar.toggleAttribute('inert', hidden);
    if (hidden) bar.setAttribute('aria-hidden', 'true');
    else bar.removeAttribute('aria-hidden');

    // Phase 9.3 — always written explicitly (never left stale from a
    // previous section) so a click on the shared bar is attributed to
    // whatever it's actually showing right now.
    link.dataset.trackSource = track.source ?? GENERIC_TRACK.source;
    link.dataset.trackItem = track.item ?? GENERIC_TRACK.item;
    link.dataset.trackItemType = track.itemType ?? GENERIC_TRACK.itemType;
    if (track.price != null) link.dataset.trackPrice = String(track.price);
    else delete link.dataset.trackPrice;
  }

  // Hidden by default: the bar only appears once the visitor has left the
  // Hero (see data-cta-mode="hidden" on SceneHero).
  setState(DEFAULT_CTA_LABEL, greetingFor('un produit Racine d’Or'), 'hidden');

  const sections = document.querySelectorAll<HTMLElement>('[data-cta-label]');
  if (sections.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // intersectionRatio is relative to the TARGET's own height, which
          // silently breaks for sticky chapters much taller than the
          // viewport (e.g. a 380svh chapter can never exceed ~0.26 ratio
          // even while its pinned stage fully fills the screen). Judge
          // dominance by how much of the *viewport* the intersection
          // covers instead — meaningful for any target size.
          const coverage = entry.intersectionRect.height / window.innerHeight;
          if (entry.isIntersecting && coverage > 0.5) {
            const text = entry.target.getAttribute('data-cta-label') || DEFAULT_CTA_LABEL;
            // `data-cta-label` is button copy ("Commander", or a full
            // "Commander X · Y FCFA" string) — never a bare item name, so
            // it must never be fed into greetingFor() (which already
            // prepends "Je souhaite commander …", producing "commander
            // Commander …"). Sections that want a product-specific
            // message provide their own data-cta-message explicitly; this
            // fallback is only ever the safe, generic default.
            const message = entry.target.getAttribute('data-cta-message') || greetingFor('un produit Racine d’Or');
            const mode = (entry.target.getAttribute('data-cta-mode') as Mode) || 'contextual';
            const trackSource = entry.target.getAttribute('data-cta-track-source');
            const trackPriceAttr = entry.target.getAttribute('data-cta-track-price');
            const track: Track = trackSource
              ? {
                  source: trackSource,
                  item: entry.target.getAttribute('data-cta-track-item') ?? undefined,
                  itemType: (entry.target.getAttribute('data-cta-track-item-type') as ItemType | null) ?? undefined,
                  price: trackPriceAttr ? Number(trackPriceAttr) : undefined,
                }
              : GENERIC_TRACK;
            setState(text, message, mode, track);
          }
        }
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
    );
    sections.forEach((s) => io.observe(s));
  }

  // Kit swipe (Scene 07) overrides the label while its own section is the
  // dominant one, and provides which exact kit is centered for tracking.
  window.addEventListener('rd:cta-override', (event) => {
    const detail = (event as CustomEvent<{ label: string; message: string; track?: Track }>).detail;
    if (detail) setState(detail.label, detail.message, 'contextual', detail.track ?? GENERIC_TRACK);
  });
}
