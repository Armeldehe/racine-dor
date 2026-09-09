import { prefersReducedMotion, observeScrollProgress } from './utils';

/**
 * Signature C — "huile -> beurre", opening with "zoomed into the
 * product": the serum bottle (carried over from the Sérum scene) scales
 * up and dissolves into its own applicator macro within the first
 * quarter of the sequence, which then fades + scales into the butter
 * macro underneath. Short and dense — the whole journey completes
 * within one extra viewport of scroll.
 */
export function initTransitionSignature(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-transition-wrapper]');
  const top = document.querySelector<HTMLElement>('[data-transition-top]');
  const product = document.querySelector<HTMLElement>('[data-transition-product]');
  if (!wrapper || !top) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    top.style.opacity = '0.5';
    if (product) product.style.opacity = '0';
    return;
  }

  observeScrollProgress(wrapper, (progress) => {
    if (product) {
      // Dissolves into the macro within the first fifth of the sequence,
      // freeing the rest of the (now shorter) range for the macro->butter
      // crossfade, which is already animating underneath at the same time.
      const productProgress = Math.min(1, progress / 0.2);
      product.style.opacity = String(1 - productProgress);
      product.style.transform = `translate(-50%, -50%) scale(${(1 + productProgress * 0.6).toFixed(3)})`;
    }
    top.style.opacity = String(1 - progress);
    top.style.transform = `scale(${(1 + progress * 0.12).toFixed(4)})`;
  });
}
