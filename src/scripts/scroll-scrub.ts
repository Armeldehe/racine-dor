/**
 * Lightweight scroll-scrubbing engine for cinematic chapters.
 *
 * Unlike the threshold-based IntersectionObserver signatures used
 * elsewhere on the site (fine for a fade that only needs to react a few
 * times), a chapter with many overlapping, continuously-transforming
 * layers needs a real 1:1 correspondence with scroll position — every
 * frame, not just at threshold crossings. IntersectionObserver here is
 * used ONLY to gate whether the (rAF-throttled) progress computation
 * runs at all, as a performance guard so nothing ticks while the
 * chapter is far off-screen. The single scroll listener is passive.
 */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Classic smoothstep — eases a sub-range of the scroll progress without
 * breaking its correspondence to the actual scroll position. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function createScrollScrubber(
  el: HTMLElement,
  onProgress: (progress: number) => void
): () => void {
  let ticking = false;
  let active = true;

  function computeAndEmit(): void {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const span = rect.height - vh;
    const progress = span > 0 ? clamp01((0 - rect.top) / span) : 0;
    onProgress(progress);
    ticking = false;
  }

  function requestTick(): void {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(computeAndEmit);
    }
  }

  function onScroll(): void {
    if (active) requestTick();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', requestTick, { passive: true });

  let io: IntersectionObserver | undefined;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          active = entry.isIntersecting;
          if (active) requestTick();
        }
      },
      { rootMargin: '35% 0px 35% 0px' }
    );
    io.observe(el);
  }

  requestTick();

  return function destroy() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', requestTick);
    io?.disconnect();
  };
}
