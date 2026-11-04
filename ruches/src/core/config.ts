/**
 * Configuration d'une installation Ruches. Une instance = ce fichier : nom, couleurs, modules, relais web.
 * Aucune adresse n'est codée en dur ailleurs : changer de domaine ne demande aucune reconstruction du cœur.
 */
import type { EngineId } from "./bangs";

export type ModuleId = "fichiers" | "plume" | "grille" | "agenda" | "taches" | "espaces";

export type RuchesConfig = {
  name: string;
  tagline: string;
  /** Dégradé de la marque (deux couleurs). */
  accent: [string, string];
  modules: Record<ModuleId, boolean>;
  /** Relais facultatif vers un moteur web externe, clairement signalé comme tel (null pour le retirer). */
  webSearch: { label: string; url: (q: string) => string } | null;
  /** Adresse de l'index Ruches Search (fichiers statiques produits par search/crawl.ts), null pour le désactiver. */
  searchIndex: string | null;
  /**
   * Portail Web, en module « Web » ou en page d'accueil : recherche, raccourcis, services du quotidien.
   * null = accueil Ruches classique (stockage). `suggest` : relais facultatif de suggestions de saisie
   * fourni par l'hôte (aucun appel n'est fait sinon).
   */
  portal: {
    /** true : le portail remplace l'accueil Ruches ; false : il est un module « Web » à côté. */
    asHome?: boolean;
    defaultEngine: EngineId;
    suggest?: (q: string, signal: AbortSignal) => Promise<string[]>;
  } | null;
};

export const DEFAULT_CONFIG: RuchesConfig = {
  name: "Ruches",
  tagline: "Tes fichiers, ton agenda, tes idées. Chez toi.",
  accent: ["#fbbf24", "#ea580c"],
  modules: { fichiers: true, plume: true, grille: true, agenda: true, taches: true, espaces: true },
  webSearch: { label: "Qwant", url: (q) => `https://www.qwant.com/?l=fr&q=${encodeURIComponent(q)}` },
  searchIndex: null,
  portal: { asHome: false, defaultEngine: "qwant" },
};
