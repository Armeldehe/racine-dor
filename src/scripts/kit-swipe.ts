import { trackEvent } from './analytics';

/**
 * Scene 07 — kit row (swipe/snap on touch, scrollable everywhere else).
 * Each card already has its own real "Commander" link (server-rendered,
 * works with JS disabled). This script only tracks which card is
 * centered, for the visual "active" state and to hand the shared
 * WhatsApp bar the right contextual label while this scene is in view.
 */
export function initKitSwipe(): void {
  const row = document.querySelector<HTMLElement>('[data-kit-row]');
  if (!row) return;

  // Phase 10 — desktop shows all three routines at once in a static grid
  // (SceneRoutines.astro's >=1024px rules); there is no "centered card"
  // concept to track there, and forcing this swipe-only behavior onto a
  // mouse-driven static layout is exactly what §15 says not to do. A
  // one-time check at init, not a resize-reactive engine.
  if (window.innerWidth >= 1024) return;

  const cards = Array.from(row.querySelectorAll<HTMLElement>('[data-kit-card]'));
  if (!cards.length || !('IntersectionObserver' in window)) return;

  // Phase 8.4 — the minimal "01 — 02 — 03" progress indicator mirrors
  // whichever card is centered, by matching data-kit-index to
  // data-kit-progress-item. Purely decorative (aria-hidden); no change
  // to the swipe/CTA logic below.
  const progressItems = Array.from(document.querySelectorAll<HTMLElement>('[data-kit-progress-item]'));

  // Using `root: row` measures intersection against the row's own
  // scrollport — that fires immediately on the very first observe() call
  // (reporting whichever card sits at scrollLeft 0) regardless of
  // whether the row itself is anywhere near the page's viewport yet.
  // The `.is-active` visual state is fine to set that early, but the
  // shared WhatsApp bar must not be hijacked by a section the visitor
  // hasn't scrolled to — so the very first callback batch only updates
  // the visual state, never the bar.
  // routine_view — at most once per kit per page session (in-memory only,
  // never persisted), so idle back-and-forth swiping doesn't spam events.
  const viewedKits = new Set<string>();

  let initial = true;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          cards.forEach((c) => c.classList.remove('is-active'));
          entry.target.classList.add('is-active');

          const activeIndex = entry.target.getAttribute('data-kit-index');
          progressItems.forEach((p) =>
            p.classList.toggle('is-active', p.getAttribute('data-kit-progress-item') === activeIndex)
          );

          const trackItem = entry.target.getAttribute('data-kit-track-item');

          if (!initial) {
            const label = entry.target.getAttribute('data-kit-cta-label');
            const message = entry.target.getAttribute('data-kit-cta-message');
            const priceAttr = entry.target.getAttribute('data-kit-track-price');
            if (label && message) {
              window.dispatchEvent(
                new CustomEvent('rd:cta-override', {
                  detail: {
                    label,
                    message,
                    track: {
                      source: 'routines',
                      item: trackItem ?? undefined,
                      itemType: 'kit',
                      price: priceAttr ? Number(priceAttr) : undefined,
                    },
                  },
                })
              );
            }
          }

          if (trackItem && !viewedKits.has(trackItem)) {
            viewedKits.add(trackItem);
            trackEvent('routine_view', { item: trackItem });
          }
        }
      }
      initial = false;
    },
    { root: row, threshold: [0.6, 0.8] }
  );

  cards.forEach((c) => io.observe(c));
}
