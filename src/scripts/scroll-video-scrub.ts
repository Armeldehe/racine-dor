import { prefersReducedMotion } from './utils';
import { createScrollScrubber, smoothstep, clamp01 } from './scroll-scrub';

/**
 * Chapter 2B prototype — scroll drives video.currentTime directly.
 * Reuses the existing scroll-scrub engine unmodified — this file only
 * adds the video-timeline mapping and the layer choreography around it.
 *
 * RESTORED to the Phase 6C state (last human-approved version) after
 * Phase 6D was rejected as a regression. Do not modify further without
 * explicit instruction.
 *
 * The source MP4 (public/assets/video/) is ~5.04s / 121 frames @ 24fps.
 * Visual inspection of every 4th frame showed three usable zones:
 *   - 0.00s -> 1.30s   bottle + applicator + drop forming (good)
 *   - 1.30s -> 3.40s   the drop stretches into a thin filament (weak)
 *   - 3.40s -> 4.95s   drop coalesces back into a full, lit macro drop
 *                      approaching the surface (good — the "hero" shot)
 * Phase 6C: the weak zone is compressed (6% of scroll) and disguised
 * with a vertical gold column + strong blur + gold overexposure (not a
 * radial blur, which doesn't match a linear artifact) rather than
 * skipped — still no jump cut.
 */
const VIDEO_SEG_A: readonly [number, number] = [0, 1.3];
const VIDEO_SEG_B: readonly [number, number] = [1.3, 3.4];
const VIDEO_SEG_C: readonly [number, number] = [3.4, 4.95];

// Scroll-progress bands (0-1 across the whole chapter). Every band
// overlaps its neighbour on purpose — see Phase 5/6 lessons on dead-scroll.
const BANDS = {
  wordsIn: [0, 0.05] as const,
  productZoom: [0.02, 0.22] as const,
  pngOut: [0.12, 0.26] as const,
  videoIn: [0.12, 0.26] as const,
  scrollA: [0.12, 0.28] as const,
  scrollB: [0.28, 0.34] as const,
  scrollC: [0.34, 0.64] as const,
  disguise: [0.26, 0.36] as const,
  videoOut: [0.6, 0.74] as const,
  matterIn: [0.6, 0.74] as const,
  maskGrow: [0.68, 0.88] as const,
  butterCutoutIn: [0.8, 0.97] as const,
  washMidIn: [0.35, 0.55] as const,
  washMidOut: [0.7, 0.85] as const,
  washLateIn: [0.74, 0.9] as const,
};

function ss(band: readonly [number, number], p: number): number {
  return smoothstep(band[0], band[1], p);
}

/** Maps a scroll progress (already inside the "video active" range) to a
 * video.currentTime, using the three-segment piecewise timeline above. */
function scrollToVideoTime(p: number): number {
  if (p <= BANDS.scrollA[1]) {
    const t = clamp01((p - BANDS.scrollA[0]) / (BANDS.scrollA[1] - BANDS.scrollA[0]));
    return VIDEO_SEG_A[0] + t * (VIDEO_SEG_A[1] - VIDEO_SEG_A[0]);
  }
  if (p <= BANDS.scrollB[1]) {
    const t = clamp01((p - BANDS.scrollB[0]) / (BANDS.scrollB[1] - BANDS.scrollB[0]));
    return VIDEO_SEG_B[0] + t * (VIDEO_SEG_B[1] - VIDEO_SEG_B[0]);
  }
  const t = clamp01((p - BANDS.scrollC[0]) / (BANDS.scrollC[1] - BANDS.scrollC[0]));
  return VIDEO_SEG_C[0] + t * (VIDEO_SEG_C[1] - VIDEO_SEG_C[0]);
}

function currentMode(p: number): string {
  if (p < BANDS.videoIn[0]) return 'IMAGE';
  if (p < BANDS.videoOut[1]) return 'VIDEO';
  if (p < BANDS.maskGrow[1]) return 'MATTER';
  return 'BUTTER';
}

export function initScrollVideoScrub(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-matter-video]');
  const videoEl = wrapper?.querySelector<HTMLVideoElement>('[data-layer="video"]') ?? null;
  if (!wrapper || !videoEl) return;
  const video: HTMLVideoElement = videoEl;

  const washA = wrapper.querySelector<HTMLElement>('[data-layer="wash-a"]');
  const washB = wrapper.querySelector<HTMLElement>('[data-layer="wash-b"]');
  const washC = wrapper.querySelector<HTMLElement>('[data-layer="wash-c"]');
  const words = wrapper.querySelector<HTMLElement>('[data-layer="words"]');
  const product = wrapper.querySelector<HTMLElement>('[data-layer="serum"]');
  const disguise = wrapper.querySelector<HTMLElement>('[data-layer="disguise"]');
  const matter = wrapper.querySelector<HTMLElement>('[data-layer="matter"]');
  const maskWrap = wrapper.querySelector<HTMLElement>('[data-layer="mask-wrap"]');
  const butterCutout = wrapper.querySelector<HTMLElement>('[data-layer="butter-cutout"]');

  if (!washA || !washB || !washC || !words || !product || !disguise || !matter || !maskWrap || !butterCutout) {
    return;
  }

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    // Static composite fallback — no video scrubbing at all.
    video.pause();
    video.style.opacity = '0';
    washA.style.opacity = '0';
    washB.style.opacity = '0';
    washC.style.opacity = '1';
    words.style.opacity = '0';
    product.style.opacity = '0';
    disguise.style.opacity = '0';
    matter.style.opacity = '0';
    maskWrap.style.clipPath = 'circle(140% at 50% 58%)';
    butterCutout.style.opacity = '1';
    butterCutout.style.clipPath = 'inset(0% 0% 0% 0%)';
    butterCutout.style.transform = 'none';
    wrapper.setAttribute('data-mode', 'BUTTER');
    wrapper.setAttribute('data-progress', '1');
    return;
  }

  // HAVE_METADATA (1) or better. Checked eagerly because a small local
  // file with preload="auto" can finish loading metadata before this
  // script attaches its listener — the "loadedmetadata" event would
  // already have fired and been missed, permanently blocking every seek.
  let metadataReady = video.readyState >= 1;
  let lastRequestedTime = -1;
  let pendingProgress = 0;

  video.addEventListener('loadedmetadata', () => {
    metadataReady = true;
    applyVideoTime(pendingProgress);
  });

  function applyVideoTime(p: number): void {
    pendingProgress = p;
    if (!metadataReady) metadataReady = video.readyState >= 1;
    if (!metadataReady || video.seekable.length === 0) return;
    const desired = Math.min(VIDEO_SEG_C[1], scrollToVideoTime(p));
    if (Math.abs(desired - lastRequestedTime) < 0.01) return;
    lastRequestedTime = desired;
    try {
      video.currentTime = desired;
    } catch {
      // Some mobile browsers reject a seek before enough data is
      // buffered — harmless, the next rAF tick will retry.
    }
  }

  createScrollScrubber(wrapper, (p) => {
    wrapper.setAttribute('data-progress', p.toFixed(4));
    wrapper.setAttribute('data-mode', currentMode(p));
    wrapper.setAttribute('data-video-time', video.currentTime.toFixed(3));

    // Background wash
    washA.style.opacity = String(1 - ss(BANDS.washMidIn, p));
    washB.style.opacity = String(ss(BANDS.washMidIn, p) * (1 - ss(BANDS.washMidOut, p)));
    washC.style.opacity = String(ss(BANDS.washLateIn, p));

    // Words — secondary, recede as the product starts pushing forward
    words.style.opacity = String(ss(BANDS.wordsIn, p) * (1 - ss(BANDS.productZoom, p)));

    // Serum bottle: zoom + settle toward the applicator, softening into
    // focus-pull blur exactly as the video sharpens in (a "rack focus"
    // read as one continuous camera move, not two different assets).
    const zoom = ss(BANDS.productZoom, p);
    const pngOutAmt = ss(BANDS.pngOut, p);
    product.style.transform = `scale(${(1 + zoom * 2.3).toFixed(3)}) translateY(${(-zoom * 4).toFixed(2)}%)`;
    product.style.opacity = String(1 - pngOutAmt);
    product.style.filter = `drop-shadow(0 20px 40px rgba(0,0,0,0.45)) blur(${(pngOutAmt * 6).toFixed(2)}px)`;

    // Video: fades in already zoomed/aligned with the product (long
    // overlap), sharpening in as the PNG blurs out, then becomes the
    // timeline itself.
    const videoInAmt = ss(BANDS.videoIn, p);
    const videoOpacity = videoInAmt * (1 - ss(BANDS.videoOut, p));
    video.style.opacity = String(videoOpacity);
    const handoffBlur = (1 - videoInAmt) * 6; // sharpens in as the PNG blurs out
    const disguiseAmt = ss(BANDS.disguise, p) * (1 - smoothstep(BANDS.disguise[1], BANDS.disguise[1] + 0.04, p));
    const filamentScale = 1 + disguiseAmt * 0.55; // scale/crop toward the good part, cropping the thin tip out
    video.style.transform = `scale(${filamentScale.toFixed(3)})`;
    video.style.filter = `blur(${(handoffBlur + disguiseAmt * 16).toFixed(2)}px) brightness(${(1 + disguiseAmt * 0.5).toFixed(2)}) saturate(${(1 + disguiseAmt * 0.7).toFixed(2)})`;
    if (videoOpacity > 0.02) applyVideoTime(p);

    // Vertical gold column over the filament zone specifically — a
    // linear shape to match a linear artifact, not a centred radial glow.
    disguise.style.opacity = String(disguiseAmt);

    // Golden "matter": starts building *before* the video fully fades,
    // so the big drop reads as becoming an abstract golden mass rather
    // than being replaced by one.
    const matterGrow = ss(BANDS.matterIn, p);
    matter.style.opacity = String(matterGrow * 0.85);
    matter.style.transform = `scale(${(1 + matterGrow * 1.8).toFixed(3)})`;

    // Butter texture revealed through a growing circular mask, anchored
    // where the drop was sitting in the video's final frames
    const maskR = ss(BANDS.maskGrow, p) * 140;
    maskWrap.style.clipPath = `circle(${maskR.toFixed(1)}% at 50% 58%)`;

    // The jar: already sizeable on its very first appearance, revealed
    // by an upward-shrinking clip (as if surfacing out of the texture)
    // rather than a flat opacity fade — never reads as "a PNG appeared".
    const cutoutIn = ss(BANDS.butterCutoutIn, p);
    const hiddenTop = (1 - cutoutIn) * 60;
    butterCutout.style.clipPath = `inset(${hiddenTop.toFixed(1)}% 0% 0% 0%)`;
    butterCutout.style.opacity = String(Math.min(1, cutoutIn * 1.5));
    butterCutout.style.transform = `translateY(${(1 - cutoutIn) * 14}px) scale(${(0.9 + cutoutIn * 0.1).toFixed(3)})`;
  });
}
