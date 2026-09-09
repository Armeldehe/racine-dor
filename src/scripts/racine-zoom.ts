import { prefersReducedMotion, observeScrollProgress } from './utils';

/**
 * Signature B — "plongée vers la racine". A slow, subtle progressive
 * zoom into the roots photograph as the visitor scrolls through the
 * sticky sequence — transform only, no layout thrash.
 */
export function initRacineZoom(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-racine-wrapper]');
  const img = document.querySelector<HTMLElement>('[data-racine-img]');
  if (!wrapper || !img) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    img.style.transform = 'scale(1.06)';
    return;
  }

  observeScrollProgress(wrapper, (progress) => {
    const scale = 1 + progress * 0.11;
    img.style.transform = `scale(${scale.toFixed(4)})`;
  });
}
