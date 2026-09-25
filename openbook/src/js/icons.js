// Petites icônes vectorielles (trait arrondi, grille 24 px), dans l'esprit
// Material Symbols Rounded. Aucune dépendance, aucun logo de marque.

const P = {
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M8.7 16a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.2" r="1.2" fill="currentColor" stroke="none"/>',
  wifiOff: '<path d="M2.5 9a14 14 0 0 1 5-3.1"/><path d="M12 5a14 14 0 0 1 9.5 4"/><path d="M8.7 16a5 5 0 0 1 6.6 0"/><path d="m3 3 18 18"/>',
  dark: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  dnd: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  fullscreen: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',
  brightness: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  power: '<path d="M12 3v8"/><path d="M6.6 6.5a7.5 7.5 0 1 0 10.8 0"/>',
  exit: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
  sparkle: '<path d="M12 3c.6 4.5 3.5 7.4 8 8-4.5.6-7.4 3.5-8 8-.6-4.5-3.5-7.4-8-8 4.5-.6 7.4-3.5 8-8Z" fill="currentColor" stroke="none"/>',
  pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z"/><path d="M12 14v6"/>',
  unpin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z"/><path d="M12 14v6"/><path d="m3 3 18 18"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
  bolt: '<path d="M13 2 5 13.5h6L10 22l8-11.5h-6Z" fill="currentColor" stroke="none"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>',
};

export function svg(name, extra = "") {
  const body = P[name] ?? P.info;
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
}

/** Batterie dessinée avec son niveau réel (0..1). */
export function batterySvg(level, charging) {
  const w = Math.max(1.5, Math.round(12 * level * 10) / 10);
  const low = level <= 0.15 && !charging;
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="7" width="17" height="10" rx="3"/>
    <path d="M21.5 10.5v3" stroke-linecap="round"/>
    <rect x="5" y="9.5" width="${w}" height="5" rx="1.2" fill="${low ? "var(--error)" : "currentColor"}" stroke="none"/>
    ${charging ? '<path d="M11.8 8.2 9.2 12.4h3.2l-1.1 3.4 3-4.6h-3.1Z" fill="var(--surface-container)" stroke="none"/>' : ""}
  </svg>`;
}

/** Remplit tous les éléments [data-icon] d'un conteneur. */
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = svg(el.dataset.icon);
  });
}
