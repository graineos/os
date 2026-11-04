import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, CircleCheck, Command, Globe, Search, FilePlus2, FolderPlus, HardDrive, Lock, Package, PackageOpen, ShieldCheck, Sheet, Sparkles, Upload } from "lucide-react";
import { emptySheet } from "../core/sheet";
import { useToast } from "./kit";
import { webIndex } from "./WebSearch";
import type { IndexManifest } from "../core/websearch";
import { ago, dayStart, moduleEnabled, formatBytes, formatWhen, NodeBadge, openTarget, reachable, saveBlob, useConfig, useModules, useVault, type RucheNav } from "./shared";

type Estimate = { quota: number; usage: number; persisted: boolean } | null;

function useStorageEstimate(tick: number) {
  const [estimate, setEstimate] = useState<Estimate>(null);
  const refresh = async () => {
    try {
      const [e, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? Promise.resolve(false)]);
      setEstimate({ quota: e.quota ?? 0, usage: e.usage ?? 0, persisted });
    } catch {
      setEstimate(null);
    }
  };
  useEffect(() => void refresh(), [tick]);
  return { estimate, refresh };
}

const COLS = 9;
const ROWS = 4;

/** Rayon de miel : chaque alvéole représente une part de ce que pèseraient tes fichiers sans la Ruche. */
function Comb({ logical, physical }: { logical: number; physical: number }) {
  const reduce = useReducedMotion();
  const total = COLS * ROWS;
  const filled = logical ? Math.max(1, Math.round((physical / logical) * total)) : 0;
  const saved = logical ? total - filled : 0;
  const r = 13;
  const w = Math.sqrt(3) * r;
  const cells = Array.from({ length: total }, (_, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    return { x: w / 2 + col * w + (row % 2 ? w / 2 : 0) + 2, y: r + row * r * 1.5 + 2, i };
  });
  const hex = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 90);
      return `${(cx + (r - 1.2) * Math.cos(a)).toFixed(1)},${(cy + (r - 1.2) * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  return (
    <svg viewBox={`0 0 ${COLS * w + w / 2 + 4} ${ROWS * r * 1.5 + r / 2 + 4}`} className="w-full max-w-[320px]" role="img" aria-label={logical ? `Stocké réellement : ${formatBytes(physical)} sur ${formatBytes(logical)}` : "Ruche vide"}>
      {cells.map(({ x, y, i }) => {
        const state = i < filled ? "honey" : i < filled + saved ? "saved" : "empty";
        return (
          <motion.polygon
            key={i}
            points={hex(x, y)}
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.02 * i, type: "spring", stiffness: 260, damping: 18 }}
            style={{ transformOrigin: `${x}px ${y}px` }}
            fill={state === "honey" ? "url(#ru-honey)" : "transparent"}
            stroke={state === "empty" ? "var(--ru-line)" : "var(--ru-honey)"}
            strokeWidth={1.4}
            strokeDasharray={state === "saved" ? "3 3" : undefined}
          />
        );
      })}
      <defs>
        <linearGradient id="ru-honey" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function RucheHome({ go, onPalette }: { go: RucheNav; onPalette: () => void }) {
  const toast = useToast();
  const config = useConfig();
  const { vault, tick } = useVault();
  const { estimate, refresh } = useStorageEstimate(tick);
  const pickFiles = useRef<HTMLInputElement>(null);
  const pickCapsule = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!vault) return null;

  const stats = vault.stats();
  const savedBytes = Math.max(0, stats.logical - stats.physical);
  const savedPct = stats.logical ? Math.round((savedBytes / stats.logical) * 100) : 0;
  const free = estimate ? Math.max(0, estimate.quota - estimate.usage) : null;
  const recent = vault.recent(16).filter((node) => reachable(config, node)).slice(0, 8);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(`Import de ${files.length} fichier${files.length > 1 ? "s" : ""}…`);
    try {
      for (const file of Array.from(files)) await vault.importFile(null, file);
      toast.ok(files.length > 1 ? `${files.length} fichiers rangés` : "Fichier rangé");
    } catch (error) {
      toast.error(error instanceof Error && /quota/i.test(error.message) ? "Plus de place sur cet appareil." : "Import impossible.");
    } finally {
      setBusy(null);
    }
  };

  const exportCapsule = async () => {
    setBusy("Préparation de la capsule…");
    try {
      const blob = await vault.exportCapsule();
      saveBlob(blob, `ruche-${new Date().toISOString().slice(0, 10)}.ruche`);
      toast.ok(`Capsule prête (${formatBytes(blob.size)})`);
    } catch {
      toast.error("La capsule n’a pas pu être créée.");
    } finally {
      setBusy(null);
    }
  };

  const importCapsule = async (file: File | undefined) => {
    if (!file) return;
    setBusy("Ouverture de la capsule…");
    try {
      const { added, cells } = await vault.importCapsule(file);
      toast.ok(added ? `${added} élément${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} (${cells} nouvelles alvéoles)` : "Rien de nouveau : tout était déjà là.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Capsule illisible.");
    } finally {
      setBusy(null);
    }
  };

  const protect = async () => {
    const ok = await navigator.storage.persist?.();
    await refresh();
    if (ok) toast.ok("Stockage protégé : le navigateur ne l’effacera plus pour faire de la place.");
    else toast.info("Le navigateur a refusé pour l’instant. Installe le site comme appli (PWA) puis réessaie.");
  };

  const newDoc = async () => go({ app: "plume", id: (await vault.createContent(null, "doc", "Document sans titre", "")).id });
  const newSheet = async () => go({ app: "grille", id: (await vault.createContent(null, "sheet", "Grille sans titre", JSON.stringify(emptySheet()))).id });

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="ru-card relative overflow-hidden p-5 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl" style={{ background: "var(--ru-honey)", opacity: 0.18 }} />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[.14em]" style={{ color: "var(--ru-honey-deep)" }}>{config.name}</p>
            <h1 className="mt-1 text-[clamp(1.7rem,6vw,2.4rem)] font-normal leading-[1.1] tracking-[-.02em]">{config.tagline}</h1>
            <p className="mt-2 max-w-[52ch] text-[15px]" style={{ color: "var(--ru-muted)" }}>
              Fichiers, documents, grilles, agenda et tâches rangés sur cet appareil. Le contenu est découpé en alvéoles : un même contenu n’est jamais stocké deux fois, et chaque version ne coûte que ce qui a changé.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Éléments" value={String(stats.files)} />
              <Stat label="Sans la Ruche" value={formatBytes(stats.logical)} />
              <Stat label="Réellement stocké" value={formatBytes(stats.physical)} />
              <Stat label="Économisé" value={stats.logical ? `${savedPct} %` : "—"} accent />
            </dl>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Comb logical={stats.logical} physical={stats.physical} />
            <p className="text-center text-[12px]" style={{ color: "var(--ru-muted)" }}>
              Alvéoles pleines : ce qui est écrit. Pointillés : ce que la Ruche t’évite de stocker.
            </p>
          </div>
        </div>
      </motion.section>

      <section aria-label="Créer" className="flex flex-wrap gap-2">
        {moduleEnabled(config, "fichiers") ? (
          <button type="button" className="ru-chip" data-strong="true" onClick={() => pickFiles.current?.click()} disabled={!!busy}>
            <Upload className="h-4 w-4" aria-hidden /> Importer des fichiers
          </button>
        ) : null}
        {moduleEnabled(config, "plume") ? <button type="button" className="ru-chip" onClick={newDoc}><FilePlus2 className="h-4 w-4" style={{ color: "#3b82f6" }} aria-hidden /> Document</button> : null}
        {moduleEnabled(config, "grille") ? <button type="button" className="ru-chip" onClick={newSheet}><Sheet className="h-4 w-4" style={{ color: "#16a34a" }} aria-hidden /> Grille</button> : null}
        {moduleEnabled(config, "agenda") ? <button type="button" className="ru-chip" onClick={() => go({ app: "agenda" })}><CalendarDays className="h-4 w-4" style={{ color: "var(--ru-violet)" }} aria-hidden /> Agenda</button> : null}
        <button type="button" className="ru-chip" onClick={onPalette}><Command className="h-4 w-4" aria-hidden /> Commandes <kbd className="ru-kbd max-lg:hidden">Ctrl K</kbd></button>
        {moduleEnabled(config, "fichiers") ? <button type="button" className="ru-chip" onClick={() => go({ app: "fichiers", nouveau: "dossier" })}><FolderPlus className="h-4 w-4" style={{ color: "var(--ru-honey)" }} aria-hidden /> Dossier</button> : null}
        {moduleEnabled(config, "fichiers") ? <input ref={pickFiles} type="file" multiple hidden onChange={(e) => { void importFiles(e.target.files); e.target.value = ""; }} /> : null}
      </section>
      {busy ? <p role="status" className="text-[14px]" style={{ color: "var(--ru-muted)" }}>{busy}</p> : null}

      <Today go={go} />
      <SearchCard go={go} />

      <section aria-label="Récents">
        <h2 className="mb-2 px-1 text-[18px] font-medium">Récents</h2>
        {recent.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((node, i) => (
              <motion.button key={node.id} type="button" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                onClick={() => go(openTarget(node))}
                className="ru-card flex items-center gap-3 p-3 text-left transition hover:-translate-y-0.5">
                <NodeBadge node={node} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{node.name}</span>
                  <span className="block text-[12px]" style={{ color: "var(--ru-muted)" }}>{ago(node.updated)} · {formatBytes(vault.sizeOf(node))}</span>
                </span>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="ru-card p-6 text-center">
            <Sparkles className="mx-auto h-6 w-6" style={{ color: "var(--ru-honey)" }} aria-hidden />
            <p className="mt-2 text-[15px] font-medium">Ta Ruche est vide</p>
            <p className="mt-1 text-[14px]" style={{ color: "var(--ru-muted)" }}>Importe un fichier ou écris ton premier document.</p>
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="ru-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: "var(--ru-surface-3)", color: "var(--ru-text)" }}><HardDrive className="h-5 w-5" aria-hidden /></span>
            <div>
              <h2 className="text-[16px] font-medium">Place sur cet appareil</h2>
              <p className="text-[13px]" style={{ color: "var(--ru-muted)" }}>
                {free !== null ? `${formatBytes(free)} disponibles pour le site` : "Estimation indisponible sur ce navigateur"} · moteur {vault.engine === "opfs" ? "système de fichiers privé" : vault.engine === "idb" ? "IndexedDB" : "mémoire (non persistant)"}
              </p>
            </div>
          </div>
          {estimate && !estimate.persisted ? (
            <button type="button" className="ru-chip mt-4" onClick={protect}><ShieldCheck className="h-4 w-4" aria-hidden /> Protéger mon stockage</button>
          ) : estimate?.persisted ? (
            <p className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "#16a34a" }}><Lock className="h-4 w-4" aria-hidden /> Stockage protégé contre l’effacement automatique</p>
          ) : null}
        </div>
        <div className="ru-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: "var(--ru-honey-soft)", color: "var(--ru-honey-deep)" }}><Package className="h-5 w-5" aria-hidden /></span>
            <div>
              <h2 className="text-[16px] font-medium">Capsule</h2>
              <p className="text-[13px]" style={{ color: "var(--ru-muted)" }}>Toute ta Ruche dans un seul fichier : sauvegarde, ou passage sur un autre appareil. Sans cloud.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="ru-chip" onClick={exportCapsule} disabled={!!busy || vault.all().length === 0}><Package className="h-4 w-4" aria-hidden /> Créer une capsule</button>
            <button type="button" className="ru-chip" onClick={() => pickCapsule.current?.click()} disabled={!!busy}><PackageOpen className="h-4 w-4" aria-hidden /> Ouvrir une capsule</button>
            <input ref={pickCapsule} type="file" accept=".ruche" hidden onChange={(e) => { void importCapsule(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </div>
      </section>

      <p className="px-1 text-[12.5px] leading-relaxed" style={{ color: "var(--ru-muted)" }}>
        Rien n’est envoyé sur un serveur : la Ruche fonctionne même hors connexion. Revers de la médaille : si tu effaces les données du site dans ton navigateur ou si tu perds l’appareil, la Ruche part avec. Garde une capsule récente.
      </p>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ background: accent ? "var(--ru-honey-soft)" : "var(--ru-surface-2)" }}>
      <dt className="text-[11.5px]" style={{ color: "var(--ru-muted)" }}>{label}</dt>
      <dd className="text-[17px] font-medium tabular-nums" style={accent ? { color: "var(--ru-honey-deep)" } : undefined}>{value}</dd>
    </div>
  );
}

/** Aujourd'hui : prochains rendez-vous et tâches urgentes, lus dans le même coffre que tout le reste. */
function Today({ go }: { go: RucheNav }) {
  const { vault } = useVault();
  const mods = useModules();
  if (!vault) return null;
  const startToday = dayStart(0);
  const events = !mods.on("agenda") ? [] : vault.objects("event").filter((e) => typeof e.props?.start === "number" && (e.props.start as number) >= startToday).sort((a, b) => (a.props!.start as number) - (b.props!.start as number)).slice(0, 3);
  const tasks = !mods.on("taches") ? [] : vault.objects("task").filter((t) => !t.props?.done && typeof t.props?.due === "number" && (t.props.due as number) < dayStart(2)).sort((a, b) => (a.props!.due as number) - (b.props!.due as number)).slice(0, 4);
  if (!events.length && !tasks.length) return null;
  return (
    <section aria-label="Prochainement" className="grid gap-3 md:grid-cols-2">
      {events.length ? (
        <div className="ru-card p-4">
          <h2 className="mb-1 flex items-center gap-2 px-1 text-[15px] font-semibold"><CalendarDays className="h-4 w-4 text-[var(--ru-violet)]" aria-hidden /> Prochains rendez-vous</h2>
          <ul>{events.map((e) => <li key={e.id}><button type="button" className="ru-row w-full text-left !min-h-[48px]" onClick={() => go(openTarget(e))}><span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{e.name}</span><span className="shrink-0 text-[12.5px] text-[var(--ru-muted)]">{formatWhen(e.props!.start as number, e.props!.allDay as boolean)}</span></button></li>)}</ul>
        </div>
      ) : null}
      {tasks.length ? (
        <div className="ru-card p-4">
          <h2 className="mb-1 flex items-center gap-2 px-1 text-[15px] font-semibold"><CircleCheck className="h-4 w-4 text-[#0891b2]" aria-hidden /> À faire bientôt</h2>
          <ul>{tasks.map((t) => <li key={t.id}><button type="button" className="ru-row w-full text-left !min-h-[48px]" onClick={() => go(openTarget(t))}><span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{t.name}</span><span className={`shrink-0 text-[12.5px] ${(t.props!.due as number) < startToday ? "font-semibold text-[var(--ru-danger)]" : "text-[var(--ru-muted)]"}`}>{(t.props!.due as number) < startToday ? "en retard" : formatWhen(t.props!.due as number, true)}</span></button></li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}

/** Ruches Search : moteur web propre, index statique et classement calculé sur l'appareil. */
function SearchCard({ go }: { go: RucheNav }) {
  const { searchIndex } = useConfig();
  const [manifest, setManifest] = useState<IndexManifest | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (searchIndex) webIndex(searchIndex).manifest().then(setManifest).catch(() => setManifest(null));
  }, [searchIndex]);
  if (!searchIndex || !manifest) return null;
  return (
    <section aria-label="Ruches Search" className="ru-card relative overflow-hidden p-5">
      <span aria-hidden className="pointer-events-none absolute -left-10 -bottom-16 h-48 w-48 rounded-full blur-3xl" style={{ background: "var(--ru-blue)", opacity: 0.12 }} />
      <h2 className="relative flex items-center gap-2 text-[16px] font-semibold"><Globe className="h-5 w-5 text-[var(--ru-blue)]" aria-hidden /> Ruches Search</h2>
      <p className="relative mt-1 text-[13px] text-[var(--ru-muted)]">
        Notre propre index : {manifest.docs.toLocaleString("fr-FR")} pages de {manifest.sites.length} sites ({manifest.sites.slice(0, 4).map((s) => s.label).join(", ")}…), mis à jour le {new Date(manifest.built).toLocaleDateString("fr-FR")}. Le classement est calculé sur ton appareil, sans historique côté serveur.
      </p>
      <form role="search" className="ru-search relative mt-3" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go({ app: "recherche", q: q.trim() }); }}>
        <Search className="h-5 w-5 shrink-0 text-[var(--ru-muted)]" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher sur le web avec Ruches" aria-label="Chercher sur le web avec Ruches Search" enterKeyHint="search" />
        {q.trim() ? <button type="submit" className="ru-chip !min-h-9" data-strong="true">Chercher</button> : null}
      </form>
    </section>
  );
}
