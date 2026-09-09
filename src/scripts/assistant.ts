import { KITS, PRODUCTS, buildWhatsAppLink, greetingFor, priceToNumber } from '../config/site';
import { prefersReducedMotion } from './utils';
import { trackEvent } from './analytics';

type Need = 'simple' | 'nourrir-fortifier' | 'zones-fragilisees' | 'complete';
type Format = 'un-soin' | 'deux-produits' | 'routine-complete';
type Outcome = { kind: 'product' | 'kit'; id: string };

// PRODUCTS/KITS ids use hyphens (e.g. "routine-ciblee", "serum100"); the
// analytics vocabulary in the Phase 9.3 brief uses underscores throughout
// (e.g. "routine_ciblee", "serum_100") — this is the one place that maps
// between them, never invented ad hoc at each call site.
const RECOMMENDATION_NAME: Record<string, string> = {
  serum100: 'serum_100',
  butter: 'butter',
  'routine-ciblee': 'routine_ciblee',
  'duo-croissance': 'duo_croissance',
  booster: 'booster',
};

/**
 * Suggestion rule (transparent, not a diagnosis) — UNCHANGED since the
 * Phase 8 simplification, and untouched by the Phase 8.3 visual redesign:
 * - "la routine la plus complète" (either question) always points to the
 *   Booster, the fullest kit;
 * - "un seul soin" resolves to a single product — the Beurre for someone
 *   caring for fragilised/thinning zones, the Sérum otherwise;
 * - "deux produits" resolves to a kit — the Routine Ciblée (Sérum + Derma
 *   Roller) for fragilised/thinning zones, the Duo Croissance otherwise.
 * This is a suggestion tool, never a medical scoring engine.
 */
function recommend(need: Need, format: Format): Outcome {
  if (need === 'complete' || format === 'routine-complete') return { kind: 'kit', id: 'booster' };
  if (format === 'un-soin') {
    return { kind: 'product', id: need === 'zones-fragilisees' ? 'butter' : 'serum100' };
  }
  return { kind: 'kit', id: need === 'zones-fragilisees' ? 'routine-ciblee' : 'duo-croissance' };
}

const STEP_TRANSITION_MS = 220;

export function initAssistant(): void {
  const root = document.querySelector<HTMLElement>('[data-assistant]');
  if (!root) return;

  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-assist-step]'));
  const startBtn = root.querySelector<HTMLButtonElement>('[data-assist-start]');
  const resultName = root.querySelector<HTMLElement>('[data-assist-result-name]');
  const resultTagline = root.querySelector<HTMLElement>('[data-assist-result-tagline]');
  const resultContents = root.querySelector<HTMLElement>('[data-assist-result-contents]');
  const resultWhy = root.querySelector<HTMLElement>('[data-assist-result-why]');
  const resultCta = root.querySelector<HTMLAnchorElement>('[data-assist-result-cta]');
  const resultImages = Array.from(root.querySelectorAll<HTMLImageElement>('[data-assist-result-image]'));

  let need: Need | null = null;
  const reduceMotion = prefersReducedMotion();

  // Reveal `index` immediately, optionally after a short "leaving"
  // animation on the currently-visible step (skipped entirely under
  // prefers-reduced-motion — never an extra delay for those visitors).
  function showStep(index: number): void {
    const currentIndex = steps.findIndex((s) => !s.hasAttribute('hidden'));
    const applyNow = () => steps.forEach((s, i) => s.toggleAttribute('hidden', i !== index));

    if (reduceMotion || currentIndex === -1 || currentIndex === index) {
      applyNow();
      return;
    }
    const outgoing = steps[currentIndex];
    outgoing.classList.add('assistant__step--leaving');
    window.setTimeout(() => {
      outgoing.classList.remove('assistant__step--leaving');
      applyNow();
    }, STEP_TRANSITION_MS);
  }

  // A brief, visible "selected" flash on the tapped option before the
  // step transitions away — never a blocking delay under reduced motion.
  function flashSelected(btn: HTMLButtonElement, next: () => void): void {
    if (reduceMotion) {
      next();
      return;
    }
    btn.classList.add('is-selected');
    window.setTimeout(next, 160);
  }

  startBtn?.addEventListener('click', () => {
    trackEvent('finder_start');
    showStep(1);
  });

  root.querySelectorAll<HTMLButtonElement>('[data-assist-need]').forEach((btn) => {
    btn.addEventListener('click', () => {
      flashSelected(btn, () => {
        need = btn.dataset.assistNeed as Need;
        showStep(2);
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-assist-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      flashSelected(btn, () => {
        const format = btn.dataset.assistFormat as Format;
        const outcome = recommend(need ?? 'simple', format);
        renderResult(outcome);
        showStep(3);
      });
    });
  });

  function renderResult(outcome: Outcome): void {
    const kit = outcome.kind === 'kit' ? KITS.find((k) => k.id === outcome.id) : undefined;
    const product = outcome.kind === 'product' ? PRODUCTS[outcome.id] : undefined;
    const name = kit ? kit.name : product!.name;
    const price = kit ? kit.price : product!.price;
    const why = kit ? kit.description : product?.description ?? '';
    const contentsLine = kit ? `${kit.contents} — ${price}` : price ?? '';

    if (resultName) resultName.textContent = name;
    if (resultTagline) resultTagline.textContent = kit?.badge ?? '';
    if (resultContents) resultContents.textContent = contentsLine;
    if (resultWhy) resultWhy.textContent = why;
    if (resultCta) {
      resultCta.href = buildWhatsAppLink(greetingFor(name, price));
      resultCta.textContent = price ? `Commander ${name} · ${price}` : `Commander ${name}`;
      resultCta.dataset.trackSource = 'finder';
      resultCta.dataset.trackItem = RECOMMENDATION_NAME[outcome.id] ?? outcome.id;
      resultCta.dataset.trackItemType = outcome.kind;
      const numericPrice = priceToNumber(price);
      if (numericPrice != null) resultCta.dataset.trackPrice = String(numericPrice);
      else delete resultCta.dataset.trackPrice;
    }
    resultImages.forEach((img) => img.toggleAttribute('hidden', img.dataset.resultFor !== outcome.id));

    // finder_complete — no free-text answers, only the resolved recommendation.
    trackEvent('finder_complete', { recommendation: RECOMMENDATION_NAME[outcome.id] ?? outcome.id });
  }

  // Step 0 = intro, 1 = need, 2 = format, 3 = result. Only re-run once this
  // section actually enters the viewport (not at page load).
  function enterAssistant(): void {
    showStep(0);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            enterAssistant();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.2 }
    );
    io.observe(root);
  } else {
    enterAssistant();
  }
}
