import {
  PRODUCTS,
  SERUM_DISCOVER_LABEL,
  SERUM_DISCOVER_MESSAGE,
  greetingFor,
} from '../config/site';

/**
 * Keeps the shared WhatsApp bar in sync with the serum size toggle.
 * 50ml has no confirmed price, so it must never drive a commercial
 * "Commander" CTA — it gets a neutral discovery label instead (matches
 * the section's own default data-cta-label, since 50ml is checked by
 * default). Only 100ml (priced) drives a real order CTA.
 */
export function initSerumToggle(): void {
  const radios = document.querySelectorAll<HTMLInputElement>('[data-serum-size]');
  if (!radios.length) return;

  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const detail =
        radio.dataset.serumSize === '100'
          ? { label: PRODUCTS.serum100.ctaLabel, message: greetingFor(PRODUCTS.serum100.name, PRODUCTS.serum100.price) }
          : { label: SERUM_DISCOVER_LABEL, message: SERUM_DISCOVER_MESSAGE };
      window.dispatchEvent(new CustomEvent('rd:cta-override', { detail }));
    });
  });
}
