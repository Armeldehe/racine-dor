import { prefersReducedMotion } from './utils';
import { createScrollScrubber, smoothstep } from './scroll-scrub';

/**
 * Chapter 2 engine — "Sérum → Applicateur → Goutte → Matière → Beurre".
 *
 * Every band below overlaps its neighbour on purpose (see Phase 6 §3):
 * the product is still visible while the macro fades in, the macro is
 * still visible while the golden mask starts growing, and so on. Read
 * top to bottom, the bands trace one continuous "camera move" rather
 * than a sequence of independent slides.
 */
const BANDS = {
  wordsIn: [0.0, 0.08] as const,
  productZoom: [0.05, 0.28] as const,
  productOut: [0.24, 0.34] as const,
  dropIn: [0.24, 0.34] as const,
  dropZoom: [0.3, 0.56] as const,
  dropOut: [0.58, 0.7] as const,
  maskGrow: [0.48, 0.74] as const,
  ringOut: [0.58, 0.7] as const,
  butterCutoutIn: [0.64, 0.84] as const,
  washForestOut: [0.4, 0.6] as const,
  washAmberIn: [0.35, 0.55] as const,
  washAmberOut: [0.7, 0.86] as const,
  washIvoireIn: [0.74, 0.9] as const,
};

function ss(band: readonly [number, number], p: number): number {
  return smoothstep(band[0], band[1], p);
}

export function initChapterMatiere(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-chapter-matiere]');
  if (!wrapper) return;

  const stage = wrapper.querySelector<HTMLElement>('.matiere__stage');
  const washForest = wrapper.querySelector<HTMLElement>('[data-layer="wash-forest"]');
  const washAmber = wrapper.querySelector<HTMLElement>('[data-layer="wash-amber"]');
  const washIvoire = wrapper.querySelector<HTMLElement>('[data-layer="wash-ivoire"]');
  const words = wrapper.querySelector<HTMLElement>('[data-layer="words"]');
  const product = wrapper.querySelector<HTMLElement>('[data-layer="serum"]');
  const dropMacro = wrapper.querySelector<HTMLElement>('[data-layer="drop-macro"]');
  const maskWrap = wrapper.querySelector<HTMLElement>('[data-layer="mask-wrap"]');
  const goldRing = wrapper.querySelector<HTMLElement>('[data-layer="gold-ring"]');
  const butterCutout = wrapper.querySelector<HTMLElement>('[data-layer="butter-cutout"]');
  if (!stage || !washForest || !washAmber || !washIvoire || !words || !product || !dropMacro || !maskWrap || !goldRing || !butterCutout) {
    return;
  }

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    // Static composite: product + words settled, jar already emerged on
    // a warm ground — one coherent frame, no mid-transformation limbo.
    washForest.style.opacity = '0';
    washAmber.style.opacity = '0';
    washIvoire.style.opacity = '1';
    words.style.opacity = '0';
    product.style.opacity = '0';
    dropMacro.style.opacity = '0';
    maskWrap.style.clipPath = 'circle(140% at 50% 55%)';
    goldRing.style.opacity = '0';
    butterCutout.style.opacity = '1';
    butterCutout.style.transform = 'none';
    return;
  }

  createScrollScrubber(wrapper, (p) => {
    // Background wash
    washForest.style.opacity = String(1 - ss(BANDS.washForestOut, p));
    washAmber.style.opacity = String(ss(BANDS.washAmberIn, p) * (1 - ss(BANDS.washAmberOut, p)));
    washIvoire.style.opacity = String(ss(BANDS.washIvoireIn, p));

    // Words — in early, recede once the product starts pushing forward
    words.style.opacity = String(ss(BANDS.wordsIn, p) * (1 - ss(BANDS.productOut, p)));

    // Serum bottle — grows toward its own applicator, then dissolves
    const zoom = ss(BANDS.productZoom, p);
    product.style.transform = `scale(${(1 + zoom * 2.2).toFixed(3)})`;
    product.style.opacity = String(1 - ss(BANDS.productOut, p));

    // Applicator + droplet macro — fades in as the product dissolves,
    // then keeps zooming toward the droplet itself
    const dropZoom = ss(BANDS.dropZoom, p);
    dropMacro.style.opacity = String(ss(BANDS.dropIn, p) * (1 - ss(BANDS.dropOut, p)));
    dropMacro.style.transform = `scale(${(1 + dropZoom * 1.7).toFixed(3)})`;

    // Golden circular reveal — liquid becomes cream inside the droplet
    const maskR = ss(BANDS.maskGrow, p) * 145;
    maskWrap.style.clipPath = `circle(${maskR.toFixed(1)}% at 50% 55%)`;
    const ringSize = Math.min(maskR, 60) * 2;
    goldRing.style.width = `${ringSize}vmax`;
    goldRing.style.height = `${ringSize}vmax`;
    goldRing.style.opacity = String(ss(BANDS.maskGrow, p) * (1 - ss(BANDS.ringOut, p)));

    // The jar emerges from the texture
    const cutoutIn = ss(BANDS.butterCutoutIn, p);
    butterCutout.style.opacity = String(cutoutIn);
    butterCutout.style.transform = `translateY(${(1 - cutoutIn) * 24}px) scale(${(0.85 + cutoutIn * 0.15).toFixed(3)})`;
  });
}
