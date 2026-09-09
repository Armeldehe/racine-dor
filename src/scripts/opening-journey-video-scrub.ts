import { prefersReducedMotion } from './utils';
import { createScrollScrubber, smoothstep } from './scroll-scrub';

/**
 * Opening Journey — Phase 7, ORIGINAL video.currentTime-scrub engine.
 * Kept only as a comparison reference after Phase 7.1 replaced the live
 * /qa/opening-journey engine with a frame-sequence canvas renderer (real
 * scroll QA found small stutters/freezes from repeated video seeking).
 * See opening-journey-scrub.ts for the current, live version. Do not
 * modify further — this is a frozen reference copy.
 *
 * Two real motion assets, used as filmed — no synthetic "liquid becomes
 * cream" disguising, no Golden Void. Both ~5.04s / 121 frames @ 24fps:
 *   - serum-goute.mp4: bottle establishing (0-1.6s) -> drop forming at
 *     the tip (1.6-2.9s, the best material, no filament artifact this
 *     time) -> detaches and falls (2.9-4.3s). The last ~0.7s (camera
 *     pulling back to the wide shot) is not used — the match cut fires
 *     while the drop is still falling near the bottom of frame.
 *   - beurre.mp4: closed jar, near-static (0-1.5s) -> gold lid opens
 *     (1.5-3.0s) -> jar tilts toward camera, texture revealed close-up
 *     (3.0-4.95s, the hero shot). The static opening gets deliberately
 *     little scroll.
 */
const SERUM_SEG_A: readonly [number, number] = [0, 1.6];
const SERUM_SEG_B: readonly [number, number] = [1.6, 2.9];
const SERUM_SEG_C: readonly [number, number] = [2.9, 4.3];
const SERUM_MAX_TIME = 4.3;

const BUTTER_SEG_A: readonly [number, number] = [0, 1.5];
const BUTTER_SEG_B: readonly [number, number] = [1.5, 3.0];
const BUTTER_SEG_C: readonly [number, number] = [3.0, 4.95];
const BUTTER_MAX_TIME = 4.95;

const BANDS = {
  hero: [0, 0.12] as const,
  heroZoomOut: [0.08, 0.2] as const,
  handoff: [0.16, 0.28] as const, // hero -> serum video crossfade
  serumScrollA: [0.24, 0.34] as const,
  serumScrollB: [0.34, 0.44] as const,
  serumScrollC: [0.44, 0.52] as const,
  serumIn: [0.16, 0.28] as const,
  serumOut: [0.49, 0.57] as const,
  flash: [0.49, 0.57] as const, // short golden match-cut
  butterIn: [0.54, 0.62] as const,
  butterScrollA: [0.58, 0.64] as const,
  butterScrollB: [0.64, 0.76] as const,
  butterScrollC: [0.76, 0.92] as const,
  exitIn: [0.88, 1.0] as const,
};

function ss(band: readonly [number, number], p: number): number {
  return smoothstep(band[0], band[1], p);
}

/** Short triangular spike — up fast, down fast — for the match-cut flash. */
function spike(band: readonly [number, number], p: number): number {
  const mid = (band[0] + band[1]) / 2;
  const up = smoothstep(band[0], mid, p);
  const down = 1 - smoothstep(mid, band[1], p);
  return Math.min(up, down);
}

function mapNonLinear(
  p: number,
  scrollA: readonly [number, number],
  scrollB: readonly [number, number],
  scrollC: readonly [number, number],
  segA: readonly [number, number],
  segB: readonly [number, number],
  segC: readonly [number, number]
): number {
  if (p <= scrollA[1]) {
    const t = Math.min(1, Math.max(0, (p - scrollA[0]) / (scrollA[1] - scrollA[0])));
    return segA[0] + t * (segA[1] - segA[0]);
  }
  if (p <= scrollB[1]) {
    const t = Math.min(1, Math.max(0, (p - scrollB[0]) / (scrollB[1] - scrollB[0])));
    return segB[0] + t * (segB[1] - segB[0]);
  }
  const t = Math.min(1, Math.max(0, (p - scrollC[0]) / (scrollC[1] - scrollC[0])));
  return segC[0] + t * (segC[1] - segC[0]);
}

// Mode breakpoints for the QA debug badge only — deliberately explicit
// (not derived from the smoothstep bands above) so the label reflects
// what a human would call each stretch of scroll: establishing +
// drop-forming reads as SERUM, the detach-and-fall reads as its own
// DROP beat, then the flash peak reads as CUT.
const MODE_DROP_START = 0.44;
const MODE_CUT_START = 0.51;
const MODE_BUTTER_START = 0.57;
const MODE_EXIT_START = 0.92;

function currentMode(p: number): string {
  if (p < BANDS.handoff[0]) return 'HERO';
  if (p < MODE_DROP_START) return 'SERUM';
  if (p < MODE_CUT_START) return 'DROP';
  if (p < MODE_BUTTER_START) return 'CUT';
  if (p < MODE_EXIT_START) return 'BUTTER';
  return 'EXIT';
}

/** Shared, robust video-seek helper (Phase 6B/6C pattern) for one <video>. */
function makeSeeker(video: HTMLVideoElement, maxTime: number) {
  let metadataReady = video.readyState >= 1;
  let lastRequestedTime = -1;
  let pendingTime = 0;

  video.addEventListener('loadedmetadata', () => {
    metadataReady = true;
    apply(pendingTime);
  });

  function apply(desiredTime: number): void {
    pendingTime = desiredTime;
    if (!metadataReady) metadataReady = video.readyState >= 1;
    if (!metadataReady || video.seekable.length === 0) return;
    const clamped = Math.min(maxTime, Math.max(0, desiredTime));
    if (Math.abs(clamped - lastRequestedTime) < 0.01) return;
    lastRequestedTime = clamped;
    try {
      video.currentTime = clamped;
    } catch {
      // Some mobile browsers reject a seek before enough data is
      // buffered — harmless, the next rAF tick will retry.
    }
  }

  return apply;
}

export function initOpeningJourney(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-opening-journey]');
  if (!wrapper) return;

  const heroImg = wrapper.querySelector<HTMLElement>('[data-layer="hero-img"]');
  const heroContent = wrapper.querySelector<HTMLElement>('[data-layer="hero-content"]');
  const serumVideo = wrapper.querySelector<HTMLVideoElement>('[data-layer="serum-video"]');
  const flash = wrapper.querySelector<HTMLElement>('[data-layer="flash"]');
  const butterVideo = wrapper.querySelector<HTMLVideoElement>('[data-layer="butter-video"]');
  const exitContent = wrapper.querySelector<HTMLElement>('[data-layer="exit-content"]');

  if (!heroImg || !heroContent || !serumVideo || !flash || !butterVideo || !exitContent) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    // Static fallback: Hero -> jar/texture -> exit, no video scrubbing.
    serumVideo.pause();
    butterVideo.pause();
    heroImg.style.opacity = '0';
    heroContent.style.opacity = '0';
    serumVideo.style.opacity = '0';
    flash.style.opacity = '0';
    butterVideo.style.opacity = '1';
    butterVideo.currentTime = BUTTER_MAX_TIME;
    exitContent.style.opacity = '1';
    wrapper.setAttribute('data-mode', 'EXIT');
    wrapper.setAttribute('data-progress', '1');
    return;
  }

  const seekSerum = makeSeeker(serumVideo, SERUM_MAX_TIME);
  const seekButter = makeSeeker(butterVideo, BUTTER_MAX_TIME);

  createScrollScrubber(wrapper, (p) => {
    wrapper.setAttribute('data-progress', p.toFixed(4));
    wrapper.setAttribute('data-mode', currentMode(p));

    // HERO — fades/zooms out as the visitor starts scrolling
    const zoomOut = ss(BANDS.heroZoomOut, p);
    heroImg.style.transform = `scale(${(1 + zoomOut * 0.18).toFixed(3)})`;
    heroImg.style.opacity = String(1 - ss(BANDS.handoff, p));
    heroContent.style.opacity = String(1 - ss(BANDS.hero, p) - Math.max(0, ss(BANDS.heroZoomOut, p) - ss(BANDS.hero, p)));
    heroContent.style.transform = `translateY(${(-zoomOut * 18).toFixed(1)}px)`;

    // SERUM VIDEO — sharpens in over the hero (rack-focus handoff), then
    // becomes the timeline for the drop's formation/detachment/fall.
    const serumInAmt = ss(BANDS.serumIn, p);
    const serumOutAmt = ss(BANDS.serumOut, p);
    serumVideo.style.opacity = String(serumInAmt * (1 - serumOutAmt));
    const handoffBlur = (1 - serumInAmt) * 5;
    const flashAmt = spike(BANDS.flash, p);
    // A brief push-in as the drop rushes past camera into the flash —
    // not the aggressive Phase 6D "extreme zoom", just a short nudge.
    const cutPush = ss(BANDS.serumOut, p) * 0.35;
    serumVideo.style.transform = `scale(${(1 + cutPush).toFixed(3)})`;
    serumVideo.style.filter = `blur(${(handoffBlur + flashAmt * 3).toFixed(2)}px) brightness(${(1 + flashAmt * 0.6).toFixed(2)})`;
    if (serumVideo.style.opacity !== '0') {
      const st = mapNonLinear(
        p,
        BANDS.serumScrollA,
        BANDS.serumScrollB,
        BANDS.serumScrollC,
        SERUM_SEG_A,
        SERUM_SEG_B,
        SERUM_SEG_C
      );
      seekSerum(st);
    }
    // Read back after seeking (not before) so the debug badge reflects
    // this frame's actual time, not the previous scroll tick's.
    wrapper.setAttribute('data-serum-time', serumVideo.currentTime.toFixed(3));

    // MATCH CUT — a short warm flash, not an abstract "matter" layer.
    flash.style.opacity = String(flashAmt);

    // BUTTER VIDEO — the jar is already present (closed lid) as the
    // flash recedes, then plays its own mapped timeline.
    const butterInAmt = ss(BANDS.butterIn, p);
    butterVideo.style.opacity = String(butterInAmt);
    butterVideo.style.transform = `scale(${(0.96 + butterInAmt * 0.04).toFixed(3)})`;
    if (butterInAmt > 0.02) {
      const bt = mapNonLinear(
        p,
        BANDS.butterScrollA,
        BANDS.butterScrollB,
        BANDS.butterScrollC,
        BUTTER_SEG_A,
        BUTTER_SEG_B,
        BUTTER_SEG_C
      );
      seekButter(bt);
    }
    wrapper.setAttribute('data-butter-time', butterVideo.currentTime.toFixed(3));

    // EXIT — editorial line + placeholder CTA fade in over the last
    // frame of texture; the butter video itself stays visible behind.
    exitContent.style.opacity = String(ss(BANDS.exitIn, p));
  });
}
