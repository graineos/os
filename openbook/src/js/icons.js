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
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  bag: '<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  widgets: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="3.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="3.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  wallpaper: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  volUp: '<path d="M4 9.5h3l4.5-4v13L7 14.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volDown: '<path d="M4 9.5h3l4.5-4v13L7 14.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>',
  volMute: '<path d="M4 9.5h3l4.5-4v13L7 14.5H4Z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  bluetooth: '<path d="m7 7 10 10-5 4.5v-19L17 7 7 17"/>',
  nightlight: '<path d="M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4"/><path d="M14.5 9.2A3.5 3.5 0 1 0 14.8 15 4 4 0 0 1 14.5 9.2Z" fill="currentColor"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  shrink: '<path d="M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7"/>',
  location: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  desktop: '<rect x="3" y="4" width="18" height="12.5" rx="2.5"/><path d="M9 20.5h6M12 16.5v4"/>',
  windows: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>',
  sun: '<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5Z" fill="currentColor" fill-opacity=".18"/>',
  partly: '<circle cx="9" cy="8.5" r="3.2" fill="currentColor" stroke="none"/><path d="M9 2.5v1.2M3.5 8.5h1.2M5 4.5l.9.9"/><path d="M9.5 19.5h8a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.2-.5 3.8 3.8 0 0 0 .9 7.5Z" fill="currentColor" fill-opacity=".18"/>',
  rain: '<path d="M7 14.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 5.6 4.5 4.5 0 0 0 7 14.5Z" fill="currentColor" fill-opacity=".18"/><path d="M8.5 17.5 7.5 20M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
  snow: '<path d="M7 14.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 5.6 4.5 4.5 0 0 0 7 14.5Z" fill="currentColor" fill-opacity=".18"/><path d="M8 18.5h.01M12 20h.01M16 18.5h.01" stroke-width="3"/>',
  storm: '<path d="M7 14.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 5.6 4.5 4.5 0 0 0 7 14.5Z" fill="currentColor" fill-opacity=".18"/><path d="m12.5 15-2 3.5h3l-2 3.5"/>',
  fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  note: '<path d="M6 3.5h9l4 4v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M14.5 3.5v4.5H19M8 12.5h8M8 16h5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17.5 10h.01M8 14h8" stroke-width="2.2"/>',
  pointer: '<path d="M5 3.5 18.5 10l-6 1.8-2.3 6.2Z"/>',
  glow: '<path d="M3 7h18" stroke-width="3"/><path d="M6 12h12M9 17h6" opacity=".5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
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
