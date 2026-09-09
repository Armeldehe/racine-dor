import { prefersReducedMotion, observeScrollProgress } from './utils';

/**
 * The serum bottle draws slightly closer as the visitor scrolls through
 * the scene — applied to the product's wrapper (not the image itself,
 * which already owns the continuous floating keyframe animation on the
 * same `transform` property; nesting keeps both effects independent).
 */
export function initSerumScale(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-serum-wrapper]');
  const product = document.querySelector<HTMLElement>('[data-serum-product]');
  if (!wrapper || !product) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  observeScrollProgress(wrapper, (progress) => {
    const scale = 1 + progress * 0.08;
    product.style.transform = `scale(${scale.toFixed(4)})`;
  });
}
