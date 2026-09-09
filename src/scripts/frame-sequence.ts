/**
 * Phase 7.1 — frame-sequence canvas renderer.
 *
 * Replaces video.currentTime scrubbing (which produced small stutters/
 * freezes under real scroll QA — repeated seeks on a local <video> don't
 * reliably decode+paint within a single rAF tick) with a plain array of
 * preloaded WebP stills, drawn to a 2D canvas. The frame shown is a pure
 * function of an index computed from scroll progress — no autonomous
 * animation, nothing time-based.
 */

type IdleCallback = (deadline: { timeRemaining(): number; didTimeout: boolean }) => void;

function requestIdle(cb: IdleCallback): void {
  const ric = (window as unknown as { requestIdleCallback?: (cb: IdleCallback) => number }).requestIdleCallback;
  if (ric) {
    ric(cb);
  } else {
    // Fallback for browsers without requestIdleCallback (Safari): a short
    // timeout with a fixed per-chunk budget instead of a real deadline.
    setTimeout(() => cb({ timeRemaining: () => 4, didTimeout: false }), 32);
  }
}

export interface FrameSequenceOptions {
  urls: string[];
  /** object-position equivalent, both 0..1 (fraction of leftover space). */
  objectPosition?: readonly [number, number];
}

export class FrameSequence {
  readonly frameCount: number;
  private urls: readonly string[];
  private images: (HTMLImageElement | undefined)[];
  private pending = new Set<number>();
  private posX: number;
  private posY: number;
  private lastDrawnImage: HTMLImageElement | undefined;
  private backgroundLoadStarted = false;

  constructor(opts: FrameSequenceOptions) {
    this.urls = opts.urls;
    this.frameCount = opts.urls.length;
    this.images = new Array(this.frameCount);
    this.posX = opts.objectPosition?.[0] ?? 0.5;
    this.posY = opts.objectPosition?.[1] ?? 0.5;
  }

  private loadFrame(index: number, onReady?: () => void): void {
    if (index < 0 || index >= this.frameCount) return;
    if (this.images[index]) {
      onReady?.();
      return;
    }
    if (this.pending.has(index)) return;
    this.pending.add(index);
    const img = new Image();
    img.decoding = 'async';
    const done = () => {
      this.pending.delete(index);
      this.images[index] = img;
      onReady?.();
    };
    img.onload = () => {
      if ('decode' in img) {
        img.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onerror = () => this.pending.delete(index);
    img.src = this.urls[index];
  }

  /** Load a single frame immediately (used for the reduced-motion static
   * frame) and invoke `onReady` once it has decoded. */
  loadOne(index: number, onReady?: () => void): void {
    this.loadFrame(index, onReady);
  }

  /** Make sure the frames right around `index` are loaded/loading now —
   * so a frame is essentially always ready by the time scroll reaches it. */
  ensureWindowLoaded(index: number, before = 2, after = 3): void {
    const start = Math.max(0, index - before);
    const end = Math.min(this.frameCount - 1, index + after);
    for (let i = start; i <= end; i++) this.loadFrame(i);
  }

  /** Background-load every remaining frame in small idle-time chunks so it
   * never competes with scrolling/rendering for the main thread. Safe to
   * call more than once — only actually runs the walk once. */
  preloadAll(): void {
    if (this.backgroundLoadStarted) return;
    this.backgroundLoadStarted = true;
    let i = 0;
    const step: IdleCallback = (deadline) => {
      const budgeted = () => (deadline.didTimeout ? true : deadline.timeRemaining() > 0);
      let guard = 0;
      while (i < this.frameCount && budgeted() && guard < 8) {
        this.loadFrame(i);
        i++;
        guard++;
      }
      if (i < this.frameCount) requestIdle(step);
    };
    requestIdle(step);
  }

  /** Forces the next draw() call to repaint even if the frame index is
   * unchanged — used after a canvas resize, whose backing buffer just
   * changed size/DPR even though scroll progress didn't move. */
  invalidate(): void {
    this.lastDrawnImage = undefined;
  }

  /** Draw `index` (object-fit: cover) if the resolved image actually
   * changed since the last draw. Falls back to the last successfully
   * displayed frame while the target is still loading — never blanks. */
  draw(ctx: CanvasRenderingContext2D, cssWidth: number, cssHeight: number, index: number): void {
    const clamped = Math.max(0, Math.min(this.frameCount - 1, index));
    const target = this.images[clamped];
    if (!target) this.loadFrame(clamped);
    const toShow = target ?? this.lastDrawnImage;
    if (!toShow || toShow === this.lastDrawnImage) return;
    this.lastDrawnImage = toShow;
    drawCover(ctx, toShow, cssWidth, cssHeight, this.posX, this.posY);
  }
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cssWidth: number,
  cssHeight: number,
  posX = 0.5,
  posY = 0.5
): void {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = cssWidth / cssHeight;
  let drawWidth: number;
  let drawHeight: number;
  if (imgRatio > canvasRatio) {
    drawHeight = cssHeight;
    drawWidth = drawHeight * imgRatio;
  } else {
    drawWidth = cssWidth;
    drawHeight = drawWidth / imgRatio;
  }
  const offsetX = (cssWidth - drawWidth) * posX;
  const offsetY = (cssHeight - drawHeight) * posY;
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

/** Sizes a canvas's backing buffer for the viewport's devicePixelRatio
 * (capped at 2 — a 592px-wide source frame gains nothing from a higher
 * backing resolution and it only costs more paint time), and returns its
 * 2D context pre-scaled so all drawing can stay in CSS pixels. */
export function fitCanvasToDisplaySize(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const targetW = Math.round(cssWidth * dpr);
  const targetH = Math.round(cssHeight * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
