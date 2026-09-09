const STORAGE_KEY = 'rd_need';

/**
 * Scene 03 — tap-to-select need chips. Purely informational, no
 * diagnosis: the pick is remembered (sessionStorage) so the assistant
 * (Scene 08) can pre-fill its first question instead of asking again.
 */
export function initNeedsSelect(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-need-option]');
  if (!buttons.length) return;

  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    buttons.forEach((btn) => {
      if (btn.dataset.needOption === saved) {
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      const value = btn.dataset.needOption;
      if (value) sessionStorage.setItem(STORAGE_KEY, value);
    });
  });
}

export function getSavedNeed(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}
