export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shared scroll-progress helper for sticky storytelling sequences.
 * Reads getBoundingClientRect only inside IntersectionObserver callbacks
 * (already rate-limited by the browser), never a raw scroll listener.
 * `target` should be a tall wrapper (position:relative) containing a
 * `position:sticky` inner layer — progress goes 0 (wrapper top just
 * reached the viewport top) to 1 (wrapper bottom reaches viewport bottom).
 */
export function observeScrollProgress(
  target: HTMLElement,
  onProgress: (progress: number) => void
): void {
  if (!('IntersectionObserver' in window)) return;

  const thresholds = Array.from({ length: 41 }, (_, i) => i / 40);
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        const vh = window.innerHeight;
        const span = rect.height - vh;
        const progress = span > 0 ? (0 - rect.top) / span : 0;
        onProgress(Math.min(1, Math.max(0, progress)));
      }
    },
    { threshold: thresholds }
  );

  io.observe(target);
}
