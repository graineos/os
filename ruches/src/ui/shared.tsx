import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, CircleCheck, File, FileArchive, FileCode, FileImage, FileText, Film, Folder, Hexagon, Music, Sheet, type LucideIcon } from "lucide-react";
import { DEFAULT_CONFIG, type RuchesConfig } from "../core/config";
import { openVault, type RucheNode, type Vault } from "../core/vault";

type VaultState = { vault: Vault | null; error: string | null; tick: number; ns?: string | null };
const EMPTY_STATE: VaultState = { vault: null, error: null, tick: 0 };
const VaultContext = createContext<VaultState>({ vault: null, error: null, tick: 0 });

const ConfigContext = createContext<RuchesConfig>(DEFAULT_CONFIG);
export const ConfigProvider = ConfigContext.Provider;
export const useConfig = () => useContext(ConfigContext);

/** Ouvre le coffre de l'espace `ns` (l'hôte fournit l'identifiant : un coffre par compte et par appareil). */
export function VaultProvider({ ns, children }: { ns: string | null; children: ReactNode }) {
  const [state, setState] = useState<VaultState>({ vault: null, error: null, tick: 0 });

  useEffect(() => {
    if (!ns) return;
    let off: (() => void) | undefined;
    let alive = true;
    openVault(ns)
      .then((vault) => {
        if (!alive) return;
        setState({ vault, error: null, tick: 0, ns });
        off = vault.subscribe(() => setState((s) => ({ ...s, tick: s.tick + 1 })));
      })
      .catch(() => alive && setState({ vault: null, error: "Le stockage local est bloqué par ce navigateur (navigation privée ?).", tick: 0, ns }));
    return () => {
      alive = false;
      off?.();
    };
  }, [ns]);

  // Changement de compte : un état qui appartient à un autre espace n'est jamais exposé, même le temps d'un rendu.
  const current = state.ns === ns ? state : EMPTY_STATE;
  return <VaultContext.Provider value={current}>{children}</VaultContext.Provider>;
}

export const useVault = () => useContext(VaultContext);

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Kio", "Mio", "Gio", "Tio"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}

export function ago(ts: number) {
  if (Date.now() - ts < 45_000) return "à l’instant";
  return `il y a ${formatDistanceToNowStrict(ts, { locale: fr })}`;
}

export function nodeIcon(node: Pick<RucheNode, "kind" | "mime" | "name">): { icon: LucideIcon; tone: string } {
  if (node.kind === "folder") return { icon: Folder, tone: "var(--ru-honey)" };
  if (node.kind === "doc") return { icon: FileText, tone: "#3b82f6" };
  if (node.kind === "sheet") return { icon: Sheet, tone: "#16a34a" };
  if (node.kind === "event") return { icon: CalendarDays, tone: "#7c3aed" };
  if (node.kind === "task") return { icon: CircleCheck, tone: "#0891b2" };
  if (node.kind === "space") return { icon: Hexagon, tone: "var(--ru-honey-deep)" };
  const mime = node.mime ?? "";
  if (mime.startsWith("image/")) return { icon: FileImage, tone: "#db2777" };
  if (mime.startsWith("video/")) return { icon: Film, tone: "#7c3aed" };
  if (mime.startsWith("audio/")) return { icon: Music, tone: "#0891b2" };
  if (/zip|rar|7z|gzip|tar/.test(mime)) return { icon: FileArchive, tone: "#a16207" };
  if (/json|javascript|xml|html|css/.test(mime) || /\.(ts|tsx|py|rs|sh|sql)$/i.test(node.name)) return { icon: FileCode, tone: "#475569" };
  if (mime.startsWith("text/") || mime === "application/pdf") return { icon: FileText, tone: "#dc2626" };
  return { icon: File, tone: "var(--ru-muted)" };
}

/** Navigation interne de Ruches (indépendante du routeur de l'hôte). */
export const RUCHE_APPS = ["accueil", "ruche", "web", "ext", "fichiers", "plume", "grille", "agenda", "taches", "espaces", "corbeille", "recherche"] as const;
export type RucheSearch = { app?: (typeof RUCHE_APPS)[number]; id?: string; dossier?: string; voir?: string; nouveau?: string; q?: string; mois?: string };
export type RucheNav = (next: RucheSearch, replace?: boolean) => void;

/** Un module désactivé dans la configuration n'est accessible par aucun chemin (lien direct, raccourci…). */
export function moduleEnabled(config: RuchesConfig, app: RucheSearch["app"]) {
  return !app || !(app in config.modules) || config.modules[app as keyof RuchesConfig["modules"]] !== false;
}

/** Où ouvrir un objet, quel que soit son type. */
export function openTarget(node: RucheNode): RucheSearch {
  switch (node.kind) {
    case "doc": return { app: "plume", id: node.id };
    case "sheet": return { app: "grille", id: node.id };
    case "folder": return { app: "fichiers", dossier: node.id };
    case "event": return { app: "agenda", id: node.id };
    case "task": return { app: "taches", id: node.id };
    case "space": return { app: "espaces", id: node.id };
    default: return { app: "fichiers", dossier: node.parent ?? undefined, voir: node.id };
  }
}

/** Un objet n'est proposé que si le module qui l'ouvre est actif (sinon le lien ne mènerait nulle part). */
export function reachable(config: RuchesConfig, node: RucheNode) {
  return moduleEnabled(config, openTarget(node).app);
}

/** Raccourci pour les écrans : quels modules sont actifs, et un objet mène-t-il quelque part ? */
export function useModules() {
  const config = useConfig();
  return useMemo(() => ({ on: (app: RucheSearch["app"]) => moduleEnabled(config, app), reachable: (node: RucheNode) => reachable(config, node) }), [config]);
}

export const KIND_LABEL: Record<RucheNode["kind"], string> = { folder: "dossier", file: "fichier", doc: "document", sheet: "grille", event: "événement", task: "tâche", space: "espace" };

/** Couleurs d'espace : seulement une couleur hexadécimale (jamais url(), var() ou autre valeur CSS). */
export function safeColor(value: unknown, fallback = "#ea580c") {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

/** Début du jour local, à n jours d'aujourd'hui (calendrier, pas des tranches de 24 h : heure d'été comprise). */
export function dayStart(offset = 0, from = Date.now()) {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset).getTime();
}

export function formatWhen(start: number, allDay?: boolean) {
  const d = new Date(start);
  return allDay
    ? d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })
    : d.toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NodeBadge({ node, size = 40 }: { node: Pick<RucheNode, "kind" | "mime" | "name">; size?: number }) {
  const { icon: Icon, tone } = nodeIcon(node);
  return (
    <span className="ru-hex grid shrink-0 place-items-center" style={{ width: size, height: size, background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} aria-hidden />
    </span>
  );
}

export function HexLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="ru-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <path d="M16 2 28.1 9v14L16 30 3.9 23V9Z" fill="url(#ru-logo)" />
      <path d="M16 9.5 21.6 12.7v6.6L16 22.5l-5.6-3.2v-6.6Z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Télécharge un Blob sous un nom donné (jamais ouvert dans un onglet : pas d'exécution possible). */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/** Texte brut → HTML Plume (un paragraphe par bloc). */
export function textToDocHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
