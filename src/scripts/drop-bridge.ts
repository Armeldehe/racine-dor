import { prefersReducedMotion, observeScrollProgress } from './utils';

/**
 * Signature A — "la goutte" (bridge half). The Hero photo stays visible
 * while the Racine photo (already underneath) takes over — a real
 * crossfade, not a cut to an empty screen — with the drop travelling
 * down as the visual link between the two. Every property below changes
 * continuously across the full 0-1 progress range — no flat plateau —
 * so one scroll gesture reads as one continuous evolution, not a wait.
 */
export function initDropBridge(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-bridge-wrapper]');
  const drop = document.querySelector<HTMLElement>('[data-bridge-drop]');
  const heroLayer = document.querySelector<HTMLElement>('[data-bridge-hero]');
  if (!wrapper || !drop) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    drop.style.opacity = '0';
    if (heroLayer) heroLayer.style.opacity = '0';
    return;
  }

  observeScrollProgress(wrapper, (progress) => {
    // Hero fades across the whole sequence — Racine is visible underneath
    // from the very start, so both coexist throughout.
    if (heroLayer) {
      heroLayer.style.opacity = String(1 - progress);
    }
    const topPercent = 20 + progress * 55; // 20% -> 75% of the viewport, always moving
    const scale = 0.9 + Math.sin(progress * Math.PI) * 0.3; // 0 and 1 both land at rest scale, still moving throughout
    const opacity = 1 - Math.pow(progress, 3); // stays near-visible early, resolves to 0 right at the end
    drop.style.transform = `translate(-50%, 0) scale(${scale.toFixed(3)})`;
    drop.style.top = `${topPercent}%`;
    drop.style.opacity = String(opacity);
  });
}
