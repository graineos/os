/**
 * Ruches Search — résultats web, calculés dans le navigateur à partir de l'index statique.
 * Toujours séparés des contenus personnels ; chaque classement est explicable (« Pourquoi ? »).
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, ExternalLink, FilePlus2, Globe, Info, LayoutList, Rows3 } from "lucide-react";
import { foldText, WebIndex, type IndexManifest, type WebResult } from "../core/websearch";
import { useToast } from "./kit";
import { escapeHtml, useConfig, useModules, useVault, type RucheNav } from "./shared";

const indexes = new Map<string, WebIndex>();
export function webIndex(base: string) {
  let index = indexes.get(base);
  if (!index) indexes.set(base, (index = new WebIndex(base)));
  return index;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; results: WebResult[]; total: number; ms: number; manifest: IndexManifest; terms: string[] };

export function useWebSearch(q: string, limit = 30) {
  const { searchIndex } = useConfig();
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    if (!searchIndex || !q.trim()) return;
    let alive = true;
    setState({ status: "loading" });
    const timer = window.setTimeout(() => {
      webIndex(searchIndex)
        .search(q, { limit })
        .then((r) => alive && setState({ status: "ready", ...r }))
        .catch((e) => alive && setState({ status: "error", message: e instanceof Error ? e.message : "Index indisponible" }));
    }, 180);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [searchIndex, q, limit]);
  return searchIndex ? state : null;
}

/** Met en évidence les mots de la requête (comparaison sans accents, racines comprises). */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const folded = foldText(text);
  if (!terms.length || folded.length !== text.length) return <>{text}</>;
  const marks: [number, number][] = [];
  for (const term of terms) {
    const re = new RegExp(`\\b${term.replace(/[^a-z0-9]/g, "")}[a-z]{0,3}`, "g");
    for (const m of folded.matchAll(re)) marks.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let at = 0;
  marks.forEach(([s, e], i) => {
    if (s < at) return;
    out.push(text.slice(at, s), <mark key={i} className="ru-mark">{text.slice(s, e)}</mark>);
    at = e;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}

const day = (ts: number) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function Why({ result }: { result: WebResult }) {
  return (
    <div className="mt-2 rounded-2xl bg-[var(--ru-surface-2)] p-3 text-[12.5px] leading-relaxed">
      <p className="font-semibold">Pourquoi ce résultat ? Score {result.score.toLocaleString("fr-FR")}</p>
      <ul className="mt-1 space-y-0.5">
        {result.explain.map((e) => (
          <li key={e.term}>
            « <b>{e.term}</b> » : {e.tf} occurrence{e.tf > 1 ? "s" : ""} pondérée{e.tf > 1 ? "s" : ""} (le titre compte triple), présent dans {e.df} page{e.df > 1 ? "s" : ""} de l’index → rareté {e.idf.toLocaleString("fr-FR")} · apport <b>{e.score.toLocaleString("fr-FR")}</b>
          </li>
        ))}
        {result.bonus.title ? <li>Tous les mots dans le titre : +{result.bonus.title.toLocaleString("fr-FR")}</li> : null}
        {result.bonus.phrase ? <li>Expression exacte trouvée : +{result.bonus.phrase.toLocaleString("fr-FR")}</li> : null}
      </ul>
      <p className="mt-1 text-[var(--ru-muted)]">Formule BM25 (k1 = 1,2 ; b = 0,75). Aucune donnée sur toi n’entre dans le calcul.</p>
    </div>
  );
}

function ResultCard({ r, terms, selected, onToggle, i }: { r: WebResult; terms: string[]; selected: boolean; onToggle?: () => void; i: number }) {
  const [why, setWhy] = useState(false);
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.025 }} className="ru-card p-4">
      <div className="flex items-start gap-3">
        {onToggle ? (
          <button type="button" role="checkbox" aria-checked={selected} aria-label={`Sélectionner « ${r.title} »`} onClick={onToggle}
            className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border" style={{ borderColor: "var(--ru-line-strong)", background: selected ? "var(--ru-honey-deep)" : "transparent", color: "#fff" }}>
            {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[12.5px] text-[var(--ru-muted)]">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold uppercase" style={{ background: "var(--ru-honey-soft)", color: "var(--ru-honey-deep)" }} aria-hidden>{r.host[0]}</span>
            <span className="truncate">{r.host}{decodeURIComponent(new URL(r.url).pathname).slice(0, 60)}</span>
          </p>
          <a href={/^https?:\/\//.test(r.url) ? r.url : undefined} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block text-[16.5px] font-semibold leading-snug text-[var(--ru-blue)] hover:underline">
            <Marked text={r.title} terms={terms} />
          </a>
          <p className="mt-1 text-[13.5px] leading-relaxed opacity-90"><Marked text={r.snippet} terms={terms} /></p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ru-muted)]">
            <span>Collectée le {day(r.fetched)}</span>
            <button type="button" className="inline-flex items-center gap-1 font-medium text-[var(--ru-honey-deep)]" aria-expanded={why} onClick={() => setWhy((v) => !v)}>
              <Info className="h-3.5 w-3.5" aria-hidden /> Pourquoi ? <ChevronDown className={`h-3.5 w-3.5 transition ${why ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </p>
          {why ? <Why result={r} /> : null}
        </div>
      </div>
    </motion.li>
  );
}

/** Résultats web complets : vue liste ou par source, filtres par site, dossier de sources. */
export function WebResults({ q, go, compact = false }: { q: string; go: RucheNav; compact?: boolean }) {
  const config = useConfig();
  const { vault } = useVault();
  const mods = useModules();
  // Le dossier de sources est un document Plume : sélection et bouton seulement si Plume est actif.
  const canCollect = mods.on("plume");
  const toast = useToast();
  const state = useWebSearch(q, compact ? 6 : 40);
  const [view, setView] = useState<"liste" | "sources">("liste");
  const [host, setHost] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useEffect(() => { setSelected(new Set()); setHost(null); }, [q]);

  const results = state?.status === "ready" ? state.results.filter((r) => !host || r.host === host) : [];
  const hosts = useMemo(() => {
    const counts = new Map<string, number>();
    if (state?.status === "ready") for (const r of state.results) counts.set(r.host, (counts.get(r.host) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [state]);

  if (!state) return null;
  if (state.status === "loading") return <p className="px-1 text-[14px] text-[var(--ru-muted)]" role="status">Recherche dans l’index Ruches…</p>;
  if (state.status === "error") return <p className="ru-card p-4 text-[14px] text-[var(--ru-muted)]">Index web indisponible pour l’instant ({state.message}). Tes contenus restent cherchables.</p>;

  const { manifest, terms } = state;
  const sources = async () => {
    if (!vault) return;
    const picked = (selected.size ? results.filter((r) => selected.has(r.id)) : results.slice(0, 8));
    const today = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });
    const html = `<h1>${escapeHtml(q)}</h1><p>Dossier de sources constitué le ${today} avec Ruches Search (${picked.length} source${picked.length > 1 ? "s" : ""}).</p><ol>${picked
      .map((r) => `<li><p><a href="${escapeHtml(r.url)}">${escapeHtml(r.title)}</a> — ${escapeHtml(r.host)}, collectée le ${day(r.fetched)}</p><blockquote>${escapeHtml(r.snippet)}</blockquote></li>`)
      .join("")}</ol><h2>Notes</h2><p></p>`;
    const doc = await vault.createContent(null, "doc", `Sources — ${q}`.slice(0, 120), html, `${q} ${picked.map((r) => `${r.title} ${r.snippet}`).join(" ")}`);
    toast.ok("Dossier de sources créé dans Plume", { label: "Ouvrir", run: () => go({ app: "plume", id: doc.id }) });
  };
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section aria-label="Résultats web">
      <p className="mb-3 px-1 text-[12.5px] text-[var(--ru-muted)]">
        {state.total.toLocaleString("fr-FR")} page{state.total > 1 ? "s" : ""} trouvée{state.total > 1 ? "s" : ""} en {state.ms} ms · index Ruches de {manifest.docs.toLocaleString("fr-FR")} pages sur {manifest.sites.length} sites, mis à jour le {day(manifest.built)}. Le classement est calculé sur ton appareil.
      </p>
      {!compact && results.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-[var(--ru-surface-2)] p-1" role="tablist" aria-label="Affichage">
            <button type="button" role="tab" aria-selected={view === "liste"} className="ru-chip !min-h-8 !px-3 !text-[13px]" data-strong={view === "liste"} onClick={() => setView("liste")}><LayoutList className="h-4 w-4" aria-hidden /> Liste</button>
            <button type="button" role="tab" aria-selected={view === "sources"} className="ru-chip !min-h-8 !px-3 !text-[13px]" data-strong={view === "sources"} onClick={() => setView("sources")}><Rows3 className="h-4 w-4" aria-hidden /> Par source</button>
          </div>
          {canCollect ? <button type="button" className="ru-chip !min-h-8 !px-3 !text-[13px]" onClick={() => void sources()}><FilePlus2 className="h-4 w-4" aria-hidden /> {selected.size ? `Dossier de sources (${selected.size})` : "Dossier de sources"}</button> : null}
        </div>
      ) : null}
      {!compact && hosts.length > 1 ? (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer par site">
          <button type="button" className="ru-chip !min-h-8 shrink-0 !px-3 !text-[12.5px]" data-strong={!host} onClick={() => setHost(null)}>Tous</button>
          {hosts.map(([h, n]) => <button key={h} type="button" className="ru-chip !min-h-8 shrink-0 !px-3 !text-[12.5px]" data-strong={host === h} onClick={() => setHost(host === h ? null : h)}>{h} · {n}</button>)}
        </div>
      ) : null}
      {results.length === 0 ? (
        <p className="ru-card p-4 text-[14px] text-[var(--ru-muted)]">Aucune page de l’index ne contient ces mots. L’index Ruches couvre pour l’instant {manifest.sites.map((s) => s.label).join(", ")}.</p>
      ) : view === "sources" && !compact ? (
        <div className="space-y-5">
          {hosts.filter(([h]) => !host || h === host).map(([h]) => (
            <div key={h}>
              <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[.06em] text-[var(--ru-muted)]">{manifest.sites.find((s) => s.host === h)?.label ?? h}</h3>
              <ul className="space-y-2">{results.filter((r) => r.host === h).map((r, i) => <ResultCard key={r.id} r={r} terms={terms} i={i} selected={selected.has(r.id)} onToggle={canCollect ? () => toggle(r.id) : undefined} />)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">{results.map((r, i) => <ResultCard key={r.id} r={r} terms={terms} i={i} selected={selected.has(r.id)} onToggle={canCollect ? () => toggle(r.id) : undefined} />)}</ul>
      )}
      {config.webSearch && !compact ? (
        <a href={config.webSearch.url(q)} target="_blank" rel="noreferrer" className="ru-chip mt-4">
          <Globe className="h-4 w-4" aria-hidden /> Élargir sur {config.webSearch.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden /> <span className="text-[12px] text-[var(--ru-muted)]">service externe</span>
        </a>
      ) : null}
    </section>
  );
}
