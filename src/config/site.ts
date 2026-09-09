/**
 * Single source of truth for WhatsApp ordering.
 * Never hardcode the number or a message string anywhere else in the codebase.
 *
 * Confirmed by the client (Phase 8.2): +225 07 98 59 22 36.
 * E.164 digits-only for wa.me — the leading 0 is kept, since Côte
 * d'Ivoire's 2021 renumbering made it part of the 10-digit subscriber
 * number rather than a trunk-access prefix to strip.
 */
export const WHATSAPP_NUMBER = '2250798592236';

export function isWhatsAppNumberConfigured(): boolean {
  return /^\d{8,15}$/.test(WHATSAPP_NUMBER);
}

/** Builds a safe wa.me link with a pre-filled, URL-encoded message. */
export function buildWhatsAppLink(message: string): string {
  const params = new URLSearchParams({ text: message });
  const number = isWhatsAppNumberConfigured() ? WHATSAPP_NUMBER : '';
  return `https://wa.me/${number}?${params.toString()}`;
}

export function greetingFor(itemLabel: string, price?: string): string {
  const priceLine = price ? ` à ${price}` : '';
  return `Bonjour Racine d'Or 🌿\nJe souhaite commander ${itemLabel}${priceLine}.`;
}

/** For items with no confirmed price yet — never a commercial "commander". */
export function discoverGreeting(itemLabel: string): string {
  return `Bonjour Racine d'Or 🌿\nJ'aimerais en savoir plus sur ${itemLabel}.`;
}

// The 50ml serum has no confirmed price (see PRODUCTS.serum50), so its
// default CTA state must stay a neutral discovery prompt, never a
// "Commander" pushed toward an unpriced item.
export const SERUM_DISCOVER_LABEL = 'Découvrir le Sérum';
export const SERUM_DISCOVER_MESSAGE = discoverGreeting('le Sérum Capillaire Fortifiant');

/** "5 000 FCFA" -> 5000, for analytics only (never displayed). undefined stays undefined. */
export function priceToNumber(price: string | undefined): number | undefined {
  if (!price) return undefined;
  const digits = price.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
}

export type Product = {
  id: string;
  name: string;
  price?: string; // undefined = not yet confirmed, never invented
  ctaLabel: string;
  description?: string;
};

export const PRODUCTS: Record<string, Product> = {
  serum50: {
    id: 'serum50',
    name: 'le Sérum Capillaire Fortifiant 50 ml',
    price: undefined,
    ctaLabel: 'Commander le Sérum 50 ml',
  },
  serum100: {
    id: 'serum100',
    name: 'le Sérum Capillaire Fortifiant 100 ml',
    price: '4 000 FCFA',
    ctaLabel: 'Commander le Sérum 100 ml · 4 000 FCFA',
    description: 'Un soin concentré pour nourrir le cuir chevelu et accompagner la pousse, goutte après goutte.',
  },
  butter: {
    id: 'butter',
    name: 'le Beurre Rénovateur',
    price: '2 500 FCFA',
    ctaLabel: 'Commander le Beurre Rénovateur · 2 500 FCFA',
    description: 'Karité, ricin, girofle, gingembre et huiles végétales, pour nourrir et protéger les cheveux.',
  },
};

// Ingredients as printed on the real label — never invent proportions.
export const BUTTER_INGREDIENTS = ['Karité', 'Ricin', 'Girofle', 'Gingembre', 'Huiles végétales'];

export type Kit = {
  id: string;
  name: string;
  contents: string;
  description: string;
  price: string;
  ctaLabel: string;
  featured?: boolean;
  badge?: string;
  /** Phase 8.4 — one-word emotional register for the Routines editorial
   * sequence (Précision / Équilibre / climax), shown as a small eyebrow
   * above the kit name. Separate from `badge`, which the Routine Finder
   * result screen still reads unchanged. */
  eyebrow: string;
};

export const KITS: Kit[] = [
  {
    id: 'routine-ciblee',
    name: 'Routine Ciblée',
    contents: 'Sérum 50 ml + Derma Roller',
    description:
      'Une routine ciblée pour accorder une attention particulière aux zones fragilisées ou clairsemées.',
    price: '5 000 FCFA',
    ctaLabel: 'Commander la Routine Ciblée · 5 000 FCFA',
    eyebrow: 'Précision',
  },
  {
    id: 'duo-croissance',
    name: 'Duo Croissance',
    contents: 'Beurre Rénovateur + Sérum 50 ml',
    description: 'Le duo essentiel pour nourrir, fortifier et accompagner ta routine capillaire.',
    price: '5 000 FCFA',
    ctaLabel: 'Commander le Duo Croissance · 5 000 FCFA',
    eyebrow: 'Équilibre',
  },
  {
    id: 'booster',
    name: 'Booster',
    contents: 'Derma Roller + Sérum + Beurre',
    description: 'La routine la plus complète pour nourrir, fortifier et prendre soin de tes racines.',
    price: '7 500 FCFA',
    ctaLabel: 'Commander le Booster · 7 500 FCFA',
    featured: true,
    badge: 'La routine complète',
    eyebrow: 'La routine complète',
  },
];

export const DEFAULT_CTA_LABEL = 'Commander';
