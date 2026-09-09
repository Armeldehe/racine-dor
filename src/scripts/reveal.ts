import { prefersReducedMotion } from './utils';

/**
 * Progressive-enhancement scroll reveal for [data-reveal] elements.
 * Content is visible by default (no-JS and reduced-motion safe); we only
 * add the "armed" (pre-hidden) state once we know JS runs and motion is ok,
 * then reveal on intersection. No essential content ever depends on this.
 */
export function initReveal(): void {
  if (prefersReducedMotion()) return;

  document.documentElement.classList.add('js-reveal');

  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!items.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
  );

  items.forEach((el) => io.observe(el));
}
