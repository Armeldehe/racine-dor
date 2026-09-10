import { prefersReducedMotion } from './utils';
import { createScrollScrubber, smoothstep } from './scroll-scrub';
import { FrameSequence, fitCanvasToDisplaySize } from './frame-sequence';

/**
 * Opening Journey — Phase 7.1 (frame-sequence canvas engine) + Phase 8.1
 * (Hero fusion). Reuses the proven scroll-scrub engine (scroll-scrub.ts,
 * unmodified). The serum/butter frame mapping (mapNonLinear, segments,
 * frame counts, the gold match-cut) is UNCHANGED since Phase 7.1 — real
 * scroll QA on the original video.currentTime engine found small
 * stutters/freezes (repeated video seeks don't reliably decode+paint
 * within a single rAF tick), so both motion assets are pre-extracted
 * WebP frame sequences drawn to a canvas. See opening-journey-video-scrub.ts
 * for the frozen video-based original.
 *
 * Phase 8.1 removed the separate static Hero photo: the serum canvas is
 * now visible (opaque) from progress 0 — its own frame 0 already reads as
 * a Hero shot — and the Hero copy is just a text overlay that fades out
 * early (HERO_FADE below) as the visitor starts scrolling.
 *
 * Two real motion assets, used as filmed — no synthetic "liquid becomes
 * cream" disguising, no Golden Void. Both sourced from ~5.04s / 121
 * frames @ 24fps masters:
 *   - serum-goute.mp4: bottle establishing (0-1.6s) -> drop forming at
 *     the tip (1.6-2.9s) -> detaches and falls (2.9-4.3s). The last
 *     ~0.7s (camera pulling back) is not used or extracted — the match
 *     cut fires while the drop is still falling near the bottom of frame.
 *   - beurre.mp4: closed jar, static (0-1.5s) -> gold lid pops and lifts
 *     off (1.5-3.0s) -> continuous push-in revealing the swirled cream
 *     texture, holding on the final close-up (3.0-4.95s, the hero shot).
 */
const SERUM_SEG_A: readonly [number, number] = [0, 1.6];
const SERUM_SEG_B: readonly [number, number] = [1.6, 2.9];
const SERUM_SEG_C: readonly [number, number] = [2.9, 4.3];
const SERUM_MAX_TIME = 4.3;
const SERUM_FRAME_COUNT = 72;

const BUTTER_SEG_A: readonly [number, number] = [0, 1.5];
const BUTTER_SEG_B: readonly [number, number] = [1.5, 3.0];
const BUTTER_SEG_C: readonly [number, number] = [3.0, 4.95];
const BUTTER_MAX_TIME = 4.95;
const BUTTER_FRAME_COUNT = 84;

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

const SERUM_FRAME_URLS = Array.from(
  { length: SERUM_FRAME_COUNT },
  (_, i) => `/assets/frames/serum-goutte/f${pad3(i)}.webp`
);
const BUTTER_FRAME_URLS = Array.from(
  { length: BUTTER_FRAME_COUNT },
  (_, i) => `/assets/frames/beurre/f${pad3(i)}.webp`
);

const BANDS = {
  // Hero/Journey sync fix — serumScrollA used to start at 0.24, so
  // mapNonLinear's clamp held serumTime pinned at 0 (frame 0, frozen) for
  // the entire [0, 0.24) range: HERO_FADE (below) finishes at p=0.09, so
  // scrolling from 0 to 0.24 fully hid the Hero text while the Journey
  // photo hadn't advanced a single frame — the "swipe 1 = text only,
  // swipe 2 = animation starts" bug. Starting this band at 0 instead
  // makes it interpolate across the whole [0, 0.34] range rather than
  // being dead until 0.24 then rushing through in only 0.10 — its END
  // (0.34) is untouched, which is exactly serumScrollB's start, so the
  // drop-forming/falling/match-cut/butter timing below is bit-for-bit
  // unchanged; only the establishing shot now actually plays instead of
  // freezing.
  serumScrollA: [0, 0.34] as const,
  serumScrollB: [0.34, 0.44] as const,
  serumScrollC: [0.44, 0.52] as const,
  serumOut: [0.49, 0.57] as const,
  flash: [0.49, 0.57] as const, // short golden match-cut
  butterIn: [0.54, 0.62] as const,
  butterScrollA: [0.58, 0.64] as const,
  butterScrollB: [0.64, 0.76] as const,
  butterScrollC: [0.76, 0.92] as const,
  exitIn: [0.88, 1.0] as const,
};

// Phase 8.1: the serum canvas is now the Hero background from progress 0
// (no more separate static Hero photo to hand off from), so the Hero
// copy only needs to clear out of the way early — it fades out well
// before the drop-forming action becomes the point of interest.
const HERO_FADE: readonly [number, number] = [0, 0.09];

// Well before butterIn (0.54) so the sequence has time to warm up in the
// background before it's ever needed on screen.
const BUTTER_PRELOAD_TRIGGER = 0.3;

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

/** time (seconds, within [0, maxTime]) -> nearest extracted frame index. */
function timeToFrameIndex(time: number, maxTime: number, frameCount: number): number {
  const t = Math.max(0, Math.min(maxTime, time));
  return Math.round((t / maxTime) * (frameCount - 1));
}

// Mode breakpoints for the QA debug badge only — deliberately explicit
// (not derived from the smoothstep bands above) so the label reflects
// what a human would call each stretch of scroll.
const MODE_DROP_START = 0.44;
const MODE_CUT_START = 0.51;
const MODE_BUTTER_START = 0.57;
const MODE_EXIT_START = 0.92;

function currentMode(p: number): string {
  if (p < HERO_FADE[1]) return 'HERO';
  if (p < MODE_DROP_START) return 'SERUM';
  if (p < MODE_CUT_START) return 'DROP';
  if (p < MODE_BUTTER_START) return 'CUT';
  if (p < MODE_EXIT_START) return 'BUTTER';
  return 'EXIT';
}

export function initOpeningJourney(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-opening-journey]');
  if (!wrapper) return;

  const scrim = wrapper.querySelector<HTMLElement>('.opening-journey__scrim');
  const heroContent = wrapper.querySelector<HTMLElement>('[data-layer="hero-content"]');
  const heroCta = wrapper.querySelector<HTMLElement>('.opening-journey__cta');
  const serumCanvas = wrapper.querySelector<HTMLCanvasElement>('[data-layer="serum-canvas"]');
  const flash = wrapper.querySelector<HTMLElement>('[data-layer="flash"]');
  const butterCanvas = wrapper.querySelector<HTMLCanvasElement>('[data-layer="butter-canvas"]');
  const exitContent = wrapper.querySelector<HTMLElement>('[data-layer="exit-content"]');

  if (!scrim || !heroContent || !heroCta || !serumCanvas || !flash || !butterCanvas || !exitContent) return;

  // Phase 10 — desktop framing only: a one-time check at init (not a
  // resize-reactive engine), nudging the crop right so the wider desktop
  // Hero column (see OpeningJourney.astro's >=1024px rules) has room to
  // breathe on the left without the bottle/jar drifting off-frame.
  // FrameSequence itself, timing, frame counts and scroll mapping are
  // untouched — this only changes drawCover's crop-position parameter.
  const isDesktopFraming = window.innerWidth >= 1024;
  const serumSeq = new FrameSequence({
    urls: SERUM_FRAME_URLS,
    objectPosition: isDesktopFraming ? [0.62, 0.42] : [0.5, 0.42],
  });
  const butterSeq = new FrameSequence({
    urls: BUTTER_FRAME_URLS,
    objectPosition: isDesktopFraming ? [0.58, 0.46] : [0.5, 0.46],
  });

  let serumCtx = fitCanvasToDisplaySize(serumCanvas);
  let butterCtx = fitCanvasToDisplaySize(butterCanvas);

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    // Static fallback: Hero -> jar/texture -> exit, no frame scrubbing.
    // Only the one frame actually shown is loaded — not the full sequences.
    scrim.style.opacity = '0';
    heroContent.style.opacity = '0';
    heroCta.style.pointerEvents = 'none';
    serumCanvas.style.opacity = '0';
    flash.style.opacity = '0';
    butterCanvas.style.opacity = '1';
    exitContent.style.opacity = '1';
    wrapper.setAttribute('data-mode', 'EXIT');
    wrapper.setAttribute('data-progress', '1');
    wrapper.setAttribute('data-serum-time', '0.000');
    wrapper.setAttribute('data-butter-time', BUTTER_MAX_TIME.toFixed(3));

    const finalIndex = BUTTER_FRAME_COUNT - 1;
    const drawFinal = () => {
      if (!butterCtx) return;
      butterSeq.invalidate();
      butterSeq.draw(butterCtx, butterCanvas.clientWidth, butterCanvas.clientHeight, finalIndex);
    };
    butterSeq.loadOne(finalIndex, drawFinal);

    window.addEventListener(
      'resize',
      () => {
        butterCtx = fitCanvasToDisplaySize(butterCanvas);
        drawFinal();
      },
      { passive: true }
    );
    return;
  }

  // The serum canvas is visible from progress 0 (it's the Hero background
  // now) — warm it up immediately rather than waiting for the first
  // scroll tick.
  serumSeq.ensureWindowLoaded(0);
  serumSeq.preloadAll();

  let butterPreloadStarted = false;
  let lastSerumIndex = -1;
  let lastButterIndex = -1;

  function redrawCurrent(): void {
    if (serumCtx) {
      serumSeq.invalidate();
      serumSeq.draw(serumCtx, serumCanvas!.clientWidth, serumCanvas!.clientHeight, Math.max(0, lastSerumIndex));
    }
    if (butterCtx) {
      butterSeq.invalidate();
      butterSeq.draw(butterCtx, butterCanvas!.clientWidth, butterCanvas!.clientHeight, Math.max(0, lastButterIndex));
    }
  }

  let resizeQueued = false;
  const ro = new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      serumCtx = fitCanvasToDisplaySize(serumCanvas);
      butterCtx = fitCanvasToDisplaySize(butterCanvas);
      redrawCurrent();
    });
  });
  ro.observe(wrapper);

  createScrollScrubber(wrapper, (p) => {
    wrapper.setAttribute('data-progress', p.toFixed(4));
    wrapper.setAttribute('data-mode', currentMode(p));

    // HERO — the serum canvas is already the background (see below); the
    // copy just needs to clear out of the way early and elegantly, never
    // an abrupt cut, and it must never stay clickable once invisible.
    const heroFade = ss(HERO_FADE, p);
    scrim.style.opacity = String(1 - heroFade);
    heroContent.style.opacity = String(1 - heroFade);
    // A slightly more "glided" exit than a plain fade — the text drifts up
    // as it leaves, not just dissolves in place.
    heroContent.style.transform = `translateY(${(-heroFade * 20).toFixed(1)}px)`;
    heroContent.style.filter = `blur(${(heroFade * 4).toFixed(2)}px)`;
    // Disable only once the CTA is nearly invisible (not merely fading) —
    // it should stay usable as long as it's plausibly still readable.
    // `inert` also removes it from the tab order / a11y tree once hidden
    // (same fix as the WhatsApp bar's own opacity:0-but-focusable bug),
    // and both lift the instant it's visible enough to use again.
    const heroInert = heroFade > 0.9;
    heroCta.style.pointerEvents = heroInert ? 'none' : 'auto';
    heroCta.toggleAttribute('inert', heroInert);

    // SERUM — the Hero background from progress 0 (its own frame 0 is the
    // bottle establishing shot), then becomes the timeline for the drop's
    // formation/detachment/fall as scroll continues.
    const serumOutAmt = ss(BANDS.serumOut, p);
    const serumOpacity = 1 - serumOutAmt;
    serumCanvas.style.opacity = String(serumOpacity);
    const flashAmt = spike(BANDS.flash, p);
    // A brief push-in as the drop rushes past camera into the flash —
    // not the aggressive Phase 6D "extreme zoom", just a short nudge.
    const cutPush = ss(BANDS.serumOut, p) * 0.35;
    serumCanvas.style.transform = `scale(${(1 + cutPush).toFixed(3)})`;
    serumCanvas.style.filter = `blur(${(flashAmt * 3).toFixed(2)}px) brightness(${(1 + flashAmt * 0.6).toFixed(2)})`;

    const serumTime = mapNonLinear(
      p,
      BANDS.serumScrollA,
      BANDS.serumScrollB,
      BANDS.serumScrollC,
      SERUM_SEG_A,
      SERUM_SEG_B,
      SERUM_SEG_C
    );
    const serumIndex = timeToFrameIndex(serumTime, SERUM_MAX_TIME, SERUM_FRAME_COUNT);
    serumSeq.ensureWindowLoaded(serumIndex);
    if (serumOpacity > 0.02 && serumCtx) {
      serumSeq.draw(serumCtx, serumCanvas.clientWidth, serumCanvas.clientHeight, serumIndex);
    }
    lastSerumIndex = serumIndex;
    wrapper.setAttribute('data-serum-time', serumTime.toFixed(3));

    // MATCH CUT — a short warm flash, not an abstract "matter" layer.
    flash.style.opacity = String(flashAmt);

    // BUTTER — the jar is already present (closed lid) as the flash
    // recedes, then plays its own mapped timeline.
    const butterInAmt = ss(BANDS.butterIn, p);
    butterCanvas.style.opacity = String(butterInAmt);
    butterCanvas.style.transform = `scale(${(0.96 + butterInAmt * 0.04).toFixed(3)})`;

    if (!butterPreloadStarted && p > BUTTER_PRELOAD_TRIGGER) {
      butterPreloadStarted = true;
      butterSeq.preloadAll();
    }

    const butterTime = mapNonLinear(
      p,
      BANDS.butterScrollA,
      BANDS.butterScrollB,
      BANDS.butterScrollC,
      BUTTER_SEG_A,
      BUTTER_SEG_B,
      BUTTER_SEG_C
    );
    const butterIndex = timeToFrameIndex(butterTime, BUTTER_MAX_TIME, BUTTER_FRAME_COUNT);
    butterSeq.ensureWindowLoaded(butterIndex);
    if (butterInAmt > 0.02 && butterCtx) {
      butterSeq.draw(butterCtx, butterCanvas.clientWidth, butterCanvas.clientHeight, butterIndex);
    }
    lastButterIndex = butterIndex;
    wrapper.setAttribute('data-butter-time', butterTime.toFixed(3));

    // EXIT — editorial line + placeholder CTA fade in over the last
    // frame of texture; the butter frame itself stays visible behind.
    exitContent.style.opacity = String(ss(BANDS.exitIn, p));
  });
}
