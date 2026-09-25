// Fonds d'écran Material 3 dessinés sur canvas à partir du schéma de couleurs.
// Le même dessin sert à l'écran et au fond d'écran Windows (Mode Googlebook).
import { colors, currentWallpaper, isDark, onThemeChange, WALLPAPERS } from "./theme.js";
import { loadUserImage, onUserWallpaper, userImage } from "./userwall.js";

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function radial(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** Forme « cookie » de Material 3 Expressive (cercle festonné). */
function cookie(ctx, cx, cy, r, lobes, depth, rotate = 0) {
  ctx.beginPath();
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * Math.PI * 2;
    const rr = r * (1 + depth * Math.cos(lobes * t));
    const x = cx + rr * Math.cos(t + rotate);
    const y = cy + rr * Math.sin(t + rotate);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function pill(ctx, cx, cy, w, h, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.restore();
}

/** Image « cover » : remplit l'écran en gardant les proportions. */
function drawCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const PATTERNS = {
  image(ctx, w, h, c) {
    const img = userImage();
    if (img) drawCover(ctx, img, w, h);
    else PATTERNS.aurora(ctx, w, h, c);
  },
  aurora(ctx, w, h, c) {
    const m = Math.max(w, h);
    radial(ctx, w * 0.12, h * 0.88, m * 0.62, c.tertiaryContainer, 0.95);
    radial(ctx, w * 0.9, h * 0.08, m * 0.58, c.primaryContainer, 1);
    radial(ctx, w * 0.75, h * 0.98, m * 0.55, c.secondaryContainer, 0.9);
    radial(ctx, w * 0.35, h * 0.3, m * 0.35, c.primaryContainer, 0.35);
  },
  blobs(ctx, w, h, c) {
    const m = Math.min(w, h);
    radial(ctx, w * 0.5, h * 0.5, Math.max(w, h) * 0.7, c.surfaceContainerHigh, 0.8);
    ctx.fillStyle = hexA(c.primaryContainer, 0.95);
    cookie(ctx, w * 0.84, h * 0.26, m * 0.3, 9, 0.06, 0.2);
    ctx.fill();
    ctx.fillStyle = hexA(c.tertiaryContainer, 0.95);
    cookie(ctx, w * 0.12, h * 0.8, m * 0.34, 4, 0.12, 0.5);
    ctx.fill();
    ctx.fillStyle = hexA(c.secondaryContainer, 0.9);
    pill(ctx, w * 0.62, h * 0.9, m * 0.75, m * 0.22, -0.35);
    ctx.fill();
    ctx.fillStyle = hexA(c.primary, 0.22);
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.18, m * 0.07, 0, Math.PI * 2);
    ctx.fill();
  },
  waves(ctx, w, h, c) {
    const layers = [
      [c.primaryContainer, 0.55, 0.9],
      [c.secondaryContainer, 0.68, 0.95],
      [c.tertiaryContainer, 0.8, 0.95],
      [c.primaryContainer, 0.9, 1],
    ];
    layers.forEach(([color, base, alpha], i) => {
      ctx.fillStyle = hexA(color, alpha);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const y = h * base + Math.sin((x / w) * Math.PI * (2 + i * 0.6) + i * 1.3) * h * 0.06;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });
    radial(ctx, w * 0.8, h * 0.15, Math.max(w, h) * 0.45, c.primaryContainer, 0.7);
  },
  dunes(ctx, w, h, c) {
    radial(ctx, w * 0.2, h * 0.1, Math.max(w, h) * 0.5, c.tertiaryContainer, 0.6);
    const hills = [
      [w * 0.15, h * 1.25, h * 0.75, c.secondaryContainer],
      [w * 0.85, h * 1.3, h * 0.8, c.primaryContainer],
      [w * 0.5, h * 1.45, h * 0.75, c.tertiaryContainer],
    ];
    for (const [x, y, r, color] of hills) {
      const g = ctx.createLinearGradient(0, y - r, 0, h);
      g.addColorStop(0, hexA(color, 1));
      g.addColorStop(1, hexA(color, 0.75));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

/** Dessine un fond d'écran dans un canvas de taille w × h (pixels réels). */
export function paint(canvas, w, h, wallpaper = currentWallpaper(), dark = isDark()) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const c = colors(wallpaper.seed, dark);
  const base = ctx.createLinearGradient(0, 0, w * 0.4, h);
  base.addColorStop(0, c.surfaceContainerLow);
  base.addColorStop(1, c.surfaceContainerHigh);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  (PATTERNS[wallpaper.pattern] ?? PATTERNS.aurora)(ctx, w, h, c);
}

/**
 * Fond d'écran pour Windows à la résolution de l'écran : { data (base64), ext }.
 * JPEG pour une photo (plus léger), PNG pour les motifs.
 */
export function exportWallpaper() {
  const dpr = devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  paint(canvas, Math.round(screen.width * dpr), Math.round(screen.height * dpr));
  const photo = currentWallpaper().pattern === "image";
  const url = photo ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png");
  return { data: url.split(",")[1], ext: photo ? "jpg" : "png" };
}

/** Miniature pour le sélecteur. */
export function thumbnail(wallpaper, w = 176, h = 110) {
  const canvas = document.createElement("canvas");
  paint(canvas, w * 2, h * 2, wallpaper);
  canvas.className = "wp-thumb";
  return canvas;
}

/** Le fond courant est-il une photo ? (lisibilité de la barre du haut) */
export const isPhoto = () => currentWallpaper().pattern === "image" && !!userImage();

export function initWallpaper() {
  const canvas = document.querySelector("#wallpaper");
  let raf = 0;
  const draw = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      document.documentElement.classList.toggle("photo", isPhoto());
      const dpr = devicePixelRatio || 1;
      paint(canvas, Math.round(innerWidth * dpr), Math.round(innerHeight * dpr));
    });
  };
  draw();
  addEventListener("resize", draw);
  onThemeChange(draw);
  onUserWallpaper(draw);
  loadUserImage();
}

export { WALLPAPERS };
