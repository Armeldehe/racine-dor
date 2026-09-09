import { prefersReducedMotion } from './utils';

/**
 * Signature A — "la goutte" (Hero half). The drop stays pinned near the
 * serum, and both the drop and the Hero's own text fade out (opacity
 * only, GPU-cheap) as the visitor scrolls away — handing off to the
 * drop-bridge sequence that continues the fall into the Racine scene.
 * Driven by IntersectionObserver thresholds instead of a raw scroll
 * listener, so there is nothing to throttle.
 */
export function initDropSignature(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-drop-wrapper]');
  const drop = document.querySelector<HTMLElement>('[data-drop]');
  const content = document.querySelector<HTMLElement>('[data-hero-content]');
  if (!wrapper || !drop) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    drop.style.opacity = '1';
    return;
  }

  const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const opacity = Math.max(0, Math.min(1, entry.intersectionRatio * 1.2));
        drop.style.opacity = String(opacity);
        if (content) {
          content.style.opacity = String(Math.max(0, Math.min(1, entry.intersectionRatio * 1.6)));
        }
      }
    },
    { threshold: thresholds }
  );

  io.observe(wrapper);
}
