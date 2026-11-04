/**
 * Ruches — application (interface web). Indépendante de l'hôte : elle reçoit l'espace (ns),
 * l'état de navigation et la configuration de l'instance, et ne connaît aucun domaine.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CalendarPlus, CircleCheck, Command, FilePlus2, FolderOpen, Globe, HardDrive, Hexagon, House, Search, Sheet, Trash2, X, type LucideIcon } from "lucide-react";
import { DEFAULT_CONFIG, type RuchesConfig } from "../core/config";
import { detectDates } from "../core/detect";
import { emptySheet } from "../core/sheet";
import { fold, type NodeKind } from "../core/vault";
import { GrilleEditor } from "./GrilleEditor";
import { Dialog, ThemeContext, ToastProvider, useTheme, useToast } from "./kit";
import { Agenda, Espaces, Taches } from "./modules";
import { PlumeEditor } from "./PlumeEditor";
import { RucheFiles, RucheTrash } from "./RucheFiles";
import { Portail, type PortalHost } from "./Portail";
import { RucheHome } from "./RucheHome";
import { WebResults } from "./WebSearch";
import { ago, ConfigProvider, formatBytes, formatWhen, HexLogo, KIND_LABEL, moduleEnabled, NodeBadge, openTarget, reachable, useConfig, useVault, VaultProvider, type RucheNav, type RucheSearch } from "./shared";
import "./ruches.css";

export { RUCHE_APPS, type RucheNav, type RucheSearch } from "./shared";
export type { PortalHost, PortalSlots } from "./Portail";

type AppId = NonNullable<RucheSearch["app"]>;
type NavItem = { app: AppId; id?: string; label: string; icon: LucideIcon; mobile: boolean };
const NAV: NavItem[] = [
  { app: "accueil", label: "Accueil", icon: House, mobile: true },
  { app: "ruche", label: "Ma Ruche", icon: HardDrive, mobile: false },
  { app: "web", label: "Web", icon: Globe, mobile: true },
  { app: "fichiers", label: "Fichiers", icon: FolderOpen, mobile: true },
  { app: "plume", label: "Plume", icon: FilePlus2, mobile: false },
  { app: "grille", label: "Grille", icon: Sheet, mobile: false },
  { app: "agenda", label: "Agenda", icon: CalendarDays, mobile: false },
  { app: "taches", label: "Tâches", icon: CircleCheck, mobile: true },
  { app: "espaces", label: "Espaces", icon: Hexagon, mobile: false },
  { app: "corbeille", label: "Corbeille", icon: Trash2, mobile: false },
];

/** Module ajouté par l'hôte (ex. « Mon site ») : il apparaît dans la navigation et s'ouvre avec ?app=ext&id=… */
export type RucheExtension = { id: string; label: string; icon: LucideIcon; element: ReactNode; mobile?: boolean };

function navFor(config: ReturnType<typeof useConfig>, extensions: RucheExtension[]): NavItem[] {
  const asHome = !!config.portal?.asHome;
  const base = NAV.filter((n) => moduleEnabled(config, n.app) && (n.app !== "web" || (config.portal && !asHome)) && (n.app !== "ruche" || asHome));
  const ext = extensions.map((e) => ({ app: "ext" as const, id: e.id, label: e.label, icon: e.icon, mobile: e.mobile ?? false }));
  const at = base.findIndex((n) => n.app === "corbeille");
  return [...base.slice(0, at < 0 ? base.length : at), ...ext, ...base.slice(at < 0 ? base.length : at)];
}

export type RuchesAppProps = {
  /** Identifiant de l'espace de stockage (ex. identifiant du compte). null = pas encore connu. */
  ns: string | null;
  search: RucheSearch;
  go: RucheNav;
  theme?: "light" | "dark" | "auto";
  config?: RuchesConfig;
  /** Hauteur réservée en bas par l'hôte (barre de gestes…), en pixels. */
  bottomInset?: number;
  /** Marge à droite de l'en-tête réservée par l'hôte (boutons flottants), en pixels. */
  rightInset?: number;
  /** Portail Ruches : emplacements et préférences fournis par l'hôte (actualités, assistant, applis…). */
  portal?: PortalHost;
  /** Éléments de l'hôte à droite de l'en-tête (compte, liens). */
  headerEnd?: ReactNode;
  /** Modules propres à l'hôte, dans la charte de Ruches. */
  extensions?: RucheExtension[];
};

export function RuchesApp({ ns, search, go, theme = "auto", config = DEFAULT_CONFIG, bottomInset = 0, rightInset = 0, portal, headerEnd, extensions = [] }: RuchesAppProps) {
  const dark = useTheme(theme);
  return (
    <ConfigProvider value={config}>
      <ThemeContext.Provider value={dark ? "dark" : "light"}>
        <VaultProvider ns={ns}>
          <div className="ru ru-root relative min-h-[100dvh]" data-theme={dark ? "dark" : "light"} style={{ ["--ru-bottom" as string]: `${bottomInset}px`, ["--ru-accent-a" as string]: config.accent[0], ["--ru-accent-b" as string]: config.accent[1] }}>
            <ToastProvider>
              <Frame search={search} go={go} rightInset={rightInset} portal={portal} headerEnd={headerEnd} extensions={extensions} />
            </ToastProvider>
          </div>
        </VaultProvider>
      </ThemeContext.Provider>
    </ConfigProvider>
  );
}

function Frame({ search, go, rightInset, portal, headerEnd, extensions }: { search: RucheSearch; go: RucheNav; rightInset: number; portal?: PortalHost; headerEnd?: ReactNode; extensions: RucheExtension[] }) {
  const { vault, error } = useVault();
  const config = useConfig();
  const [palette, setPalette] = useState(false);
  const requested = search.app ?? "accueil";
  const extension = requested === "ext" ? extensions.find((e) => e.id === search.id) : undefined;
  const app = (requested === "ext" && !extension) || (requested === "web" && !config.portal) || !moduleEnabled(config, requested) ? "accueil" : requested;
  const nav = navFor(config, extensions);
  const portalHere = !!config.portal && (app === "web" || (app === "accueil" && !!config.portal.asHome));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="ru-comb-bg" aria-hidden />
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 px-4 backdrop-blur-md lg:px-6" style={{ background: "color-mix(in srgb, var(--ru-bg) 86%, transparent)", paddingRight: Math.max(16, rightInset) }}>
        <button type="button" onClick={() => go({})} className="flex shrink-0 items-center gap-2" aria-label={`Accueil de ${config.name}`}>
          <HexLogo />
          <span className="hidden text-[20px] font-semibold tracking-[-.02em] sm:inline">{config.name}</span>
        </button>
        <Boussole search={search} go={go} />
        <button type="button" className="ru-icon-btn shrink-0" aria-label="Palette de commandes (Ctrl+K)" title="Commandes (Ctrl+K)" onClick={() => setPalette(true)}><Command className="h-5 w-5" aria-hidden /></button>
        {headerEnd}
      </header>

      <nav className="ru-nav" aria-label={`Applications de ${config.name}`}>
        {nav.map(({ app: target, id, label, icon: Icon, mobile }) => {
          const active = app === target && (target !== "ext" || search.id === id);
          return (
          <button key={`${target}-${id ?? ""}`} type="button" className="ru-nav-item" data-mobile={mobile} data-active={active} aria-current={active ? "page" : undefined} onClick={() => go(id ? { app: target, id } : { app: target })}>
            <span className="ru-pill"><Icon className="h-5 w-5" aria-hidden /></span>
            {label}
          </button>
          );
        })}
      </nav>

      <div className="ru-main relative z-10 px-4 pt-2 lg:px-6">
        <div className="mx-auto max-w-6xl">
          {extension ? (
            <div key={extension.id}>{extension.element}</div>
          ) : portalHere ? (
            // Le portail fonctionne même sans coffre (navigation privée, stockage bloqué) : seule « Ta Ruche » attend.
            <>
              {error ? <p className="ru-card mb-4 p-4 text-center text-[14px]">{error} La recherche et les raccourcis restent disponibles.</p> : null}
              <Portail go={go} onPalette={() => setPalette(true)} host={portal} module={app === "web"} />
            </>
          ) : error ? (
            <p className="ru-card p-6 text-center text-[15px]">{error}</p>
          ) : !vault ? (
            <div className="grid min-h-[50vh] place-items-center" role="status">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}><HexLogo size={44} /></motion.div>
              <span className="sr-only">Ouverture…</span>
            </div>
          ) : app === "fichiers" ? (
            <RucheFiles key={search.dossier ?? "root"} go={go} search={search} />
          ) : app === "plume" ? (
            search.id ? <PlumeEditor key={search.id} id={search.id} go={go} /> : <Library kind="doc" go={go} />
          ) : app === "grille" ? (
            search.id ? <GrilleEditor key={search.id} id={search.id} go={go} /> : <Library kind="sheet" go={go} />
          ) : app === "agenda" ? (
            <Agenda search={search} go={go} />
          ) : app === "taches" ? (
            <Taches search={search} go={go} />
          ) : app === "espaces" ? (
            <Espaces search={search} go={go} />
          ) : app === "corbeille" ? (
            <Section title="Corbeille"><RucheTrash /></Section>
          ) : app === "recherche" ? (
            <Results q={search.q ?? ""} go={go} />
          ) : (
            <RucheHome go={go} onPalette={() => setPalette(true)} />
          )}
          {app === "fichiers" || app === "ruche" || (app === "accueil" && !config.portal?.asHome) ? (
            <div className="mt-6 flex flex-wrap gap-2 lg:hidden">
              {moduleEnabled(config, "plume") ? <button type="button" className="ru-chip" onClick={() => go({ app: "plume" })}><FilePlus2 className="h-4 w-4" aria-hidden /> Documents</button> : null}
              {moduleEnabled(config, "grille") ? <button type="button" className="ru-chip" onClick={() => go({ app: "grille" })}><Sheet className="h-4 w-4" aria-hidden /> Grilles</button> : null}
              <button type="button" className="ru-chip" onClick={() => go({ app: "corbeille" })}><Trash2 className="h-4 w-4" aria-hidden /> Corbeille</button>
            </div>
          ) : null}
        </div>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} go={go} nav={nav} />
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[clamp(1.6rem,5vw,2.2rem)] font-semibold tracking-[-.02em]">{title}</h1>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Bibliothèque Plume (documents) ou Grille (tableaux), tous dossiers confondus. */
function Library({ kind, go }: { kind: Extract<NodeKind, "doc" | "sheet">; go: RucheNav }) {
  const { vault } = useVault();
  if (!vault) return null;
  const app = kind === "doc" ? "plume" : "grille";
  const items = vault.all().filter((n) => n.kind === kind && !vault.isTrashed(n)).sort((a, b) => b.updated - a.updated);
  const create = async () => {
    const node = kind === "doc" ? await vault.createContent(null, "doc", "Document sans titre", "") : await vault.createContent(null, "sheet", "Grille sans titre", JSON.stringify(emptySheet()));
    go({ app, id: node.id });
  };
  return (
    <Section
      title={kind === "doc" ? "Plume · documents" : "Grille · tableaux"}
      action={<button type="button" className="ru-chip" data-strong="true" onClick={create}>{kind === "doc" ? <FilePlus2 className="h-4 w-4" aria-hidden /> : <Sheet className="h-4 w-4" aria-hidden />} Nouveau</button>}
    >
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((node, i) => (
            <motion.button key={node.id} type="button" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} onClick={() => go({ app, id: node.id })}
              className="ru-card group flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5">
              <span className="relative block h-28 overflow-hidden px-4 pt-4 text-[10px] leading-snug text-[var(--ru-muted)]" style={{ background: kind === "doc" ? "color-mix(in srgb,#3b82f6 8%,var(--ru-bg))" : "color-mix(in srgb,#16a34a 8%,var(--ru-bg))" }}>
                {node.text ? node.text.slice(0, 260) : <span className="opacity-60">Vide</span>}
                <span className="absolute inset-x-0 bottom-0 h-10" style={{ background: "linear-gradient(transparent, var(--ru-surface))" }} />
              </span>
              <span className="flex items-center gap-2 p-3">
                <NodeBadge node={node} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{node.name}</span>
                  <span className="block text-[12px] text-[var(--ru-muted)]">{ago(node.updated)}</span>
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      ) : (
        <p className="ru-card p-6 text-center text-[15px] text-[var(--ru-muted)]">{kind === "doc" ? "Aucun document. Crée le premier !" : "Aucune grille. Crée la première !"}</p>
      )}
    </Section>
  );
}

/** Boussole : la recherche, locale et instantanée, dans tout ce que contient l'instance. */
function Boussole({ search, go }: { search: RucheSearch; go: RucheNav }) {
  const [value, setValue] = useState(search.q ?? "");
  const input = useRef<HTMLInputElement>(null);
  const previous = useRef<RucheSearch | null>(null);

  useEffect(() => setValue(search.q ?? ""), [search.q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !target.isContentEditable && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && target.getAttribute("role") !== "grid") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = (q: string) => {
    setValue(q);
    if (search.app !== "recherche") previous.current = search;
    if (q.trim()) go({ app: "recherche", q }, search.app === "recherche");
    else go(previous.current ?? {}, true);
  };

  return (
    <form role="search" className="ru-search min-w-0 flex-1 lg:max-w-2xl" onSubmit={(e) => { e.preventDefault(); input.current?.blur(); }}>
      <Search className="h-5 w-5 shrink-0 text-[var(--ru-muted)]" aria-hidden />
      <input ref={input} value={value} onChange={(e) => update(e.target.value)} placeholder="Chercher partout" aria-label="Chercher dans tes fichiers, documents, agenda, tâches et espaces" enterKeyHint="search" />
      {value ? <button type="button" className="ru-icon-btn !h-9 !w-9" aria-label="Effacer" onClick={() => update("")}><X className="h-4 w-4" aria-hidden /></button> : <kbd className="ru-kbd hidden lg:inline-grid">/</kbd>}
    </form>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const terms = fold(q).split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return <>{text}</>;
  const folded = fold(text);
  if (folded.length !== text.length) return <>{text}</>;
  const marks: [number, number][] = [];
  for (const term of terms) for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + term.length)) marks.push([at, at + term.length]);
  marks.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let cursor = 0;
  marks.forEach(([s, e], i) => {
    if (s < cursor) return;
    out.push(text.slice(cursor, s), <mark key={i} className="ru-mark">{text.slice(s, e)}</mark>);
    cursor = e;
  });
  out.push(text.slice(cursor));
  return <>{out}</>;
}

function Results({ q, go }: { q: string; go: RucheNav }) {
  const { vault } = useVault();
  const config = useConfig();
  const [tab, setTab] = useState<"tout" | "perso" | "web">("tout");
  if (!vault) return null;
  const results = vault.search(q).filter(({ node }) => reachable(config, node));
  const web = !!config.searchIndex;
  const personal = (limit?: number) => (
    <ul className="space-y-1">
      {results.slice(0, limit).map(({ node, snippet }) => (
        <li key={node.id}>
          <button type="button" className="ru-row w-full text-left" onClick={() => go(openTarget(node))}>
            <NodeBadge node={node} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium"><Highlight text={node.name} q={q} /></span>
              {snippet ? <span className="line-clamp-2 block text-[13px] text-[var(--ru-muted)]"><Highlight text={snippet} q={q} /></span> : null}
              <span className="block text-[12px] text-[var(--ru-muted)]">
                {KIND_LABEL[node.kind]}
                {node.kind === "event" && typeof node.props?.start === "number" ? ` · ${formatWhen(node.props.start, node.props.allDay as boolean)}` : ""}
                {["file", "doc", "sheet"].includes(node.kind) ? ` · ${formatBytes(vault.sizeOf(node))} · ${ago(node.updated)}` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
  const personalHeader = (
    <p className="mb-2 px-1 text-[14px] text-[var(--ru-muted)]">
      {results.length ? `${results.length} résultat${results.length > 1 ? "s" : ""} dans tes contenus` : "Rien dans tes contenus."} · cherché sur l’appareil, rien n’est envoyé.
    </p>
  );
  return (
    <section aria-live="polite">
      {web ? (
        <div className="mb-4 flex rounded-full bg-[var(--ru-surface-2)] p-1 sm:w-fit" role="tablist" aria-label="Où chercher">
          {([["tout", "Tout"], ["perso", "Mes contenus"], ["web", "Web"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="ru-chip !min-h-9 flex-1 !px-3 !text-[13.5px] sm:flex-none" data-strong={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      ) : null}
      {tab === "perso" || !web ? (
        <>{personalHeader}{personal()}</>
      ) : tab === "web" ? (
        <WebResults q={q} go={go} />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-[.06em] text-[var(--ru-muted)]">Tes contenus · privé</h2>
            {personalHeader}
            {personal(5)}
            {results.length > 5 ? <button type="button" className="ru-chip mt-2 !min-h-9" onClick={() => setTab("perso")}>Voir les {results.length} résultats</button> : null}
          </div>
          <div>
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-[.06em] text-[var(--ru-muted)]">Web · index Ruches</h2>
            <WebResults q={q} go={go} compact />
            <button type="button" className="ru-chip mt-3 !min-h-9" onClick={() => setTab("web")}>{moduleEnabled(config, "plume") ? "Tous les résultats web, filtres et dossier de sources" : "Tous les résultats web et filtres"}</button>
          </div>
        </div>
      )}
      {!web && config.webSearch ? (
        <a href={config.webSearch.url(q)} target="_blank" rel="noreferrer" className="ru-chip mt-5">
          <Globe className="h-4 w-4" aria-hidden /> Chercher « {q.length > 40 ? `${q.slice(0, 40)}…` : q} » sur le web ({config.webSearch.label}, service externe)
        </a>
      ) : null}
    </section>
  );
}

type Command = { id: string; label: string; hint?: string; icon: ReactNode; run: () => void | Promise<void> };

/**
 * Palette de commandes : une seule entrée pour tout faire.
 * Une phrase avec une date (« dentiste jeudi 9h ») propose directement l'événement ou la tâche correspondants.
 */
function Palette({ open, onClose, go, nav }: { open: boolean; onClose: () => void; go: RucheNav; nav: NavItem[] }) {
  const { vault } = useVault();
  const config = useConfig();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    if (!vault) return [];
    const done = (fn: () => void | Promise<void>) => async () => { onClose(); await fn(); };
    const text = q.trim();
    const date = text ? detectDates(text)[0] : undefined;
    const title = date ? text.replace(date.text, "").replace(/\s+/g, " ").trim() || text : text;
    const smart: Command[] = date
      ? [
          { id: "ev", label: `Créer l’événement « ${title} »`, hint: formatWhen(date.start, date.allDay), icon: <CalendarPlus className="h-5 w-5" />, run: done(async () => { const n = await vault.createObject("event", title, { start: date.start, allDay: date.allDay }); toast.ok("Événement ajouté", { label: "Voir", run: () => go({ app: "agenda", id: n.id }) }); }) },
          { id: "tk", label: `Créer la tâche « ${title} »`, hint: `échéance ${formatWhen(date.start, true)}`, icon: <CircleCheck className="h-5 w-5" />, run: done(async () => { await vault.createObject("task", title, { done: false, due: date.start }); toast.ok("Tâche créée", { label: "Voir", run: () => go({ app: "taches" }) }); }) },
        ]
      : text
        ? [{ id: "tk", label: `Créer la tâche « ${text} »`, icon: <CircleCheck className="h-5 w-5" />, run: done(async () => { await vault.createObject("task", text, { done: false }); toast.ok("Tâche créée"); }) }]
        : [];
    const base: Command[] = [
      { id: "doc", label: "Nouveau document", icon: <FilePlus2 className="h-5 w-5" />, run: done(async () => go({ app: "plume", id: (await vault.createContent(null, "doc", text || "Document sans titre", "")).id })) },
      { id: "sheet", label: "Nouvelle grille", icon: <Sheet className="h-5 w-5" />, run: done(async () => go({ app: "grille", id: (await vault.createContent(null, "sheet", text || "Grille sans titre", JSON.stringify(emptySheet()))).id })) },
      { id: "space", label: "Nouvel espace", icon: <Hexagon className="h-5 w-5" />, run: done(async () => go({ app: "espaces", id: (await vault.createObject("space", text || "Nouvel espace", { color: "#ea580c" })).id })) },
      ...nav.map((n) => ({ id: `go-${n.app}${n.id ? `-${n.id}` : ""}`, label: `Aller à : ${n.label}`, icon: <n.icon className="h-5 w-5" />, run: done(() => go(n.id ? { app: n.app, id: n.id } : { app: n.app })) })),
    ].filter((c) => !text || fold(c.label).includes(fold(text)) || c.id === "doc" || c.id === "sheet" || c.id === "space");
    const found: Command[] = text
      ? vault.search(text, 8).filter(({ node }) => reachable(config, node)).map(({ node }) => ({ id: node.id, label: node.name, hint: KIND_LABEL[node.kind], icon: <NodeBadge node={node} size={28} />, run: done(() => go(openTarget(node))) }))
      : vault.recent(5).filter((node) => reachable(config, node)).map((node) => ({ id: node.id, label: node.name, hint: `récent · ${KIND_LABEL[node.kind]}`, icon: <NodeBadge node={node} size={28} />, run: done(() => go(openTarget(node))) }));
    const allowed = (c: Command) =>
      (c.id !== "doc" || moduleEnabled(config, "plume")) && (c.id !== "sheet" || moduleEnabled(config, "grille")) && (c.id !== "space" || moduleEnabled(config, "espaces")) && (c.id !== "ev" || moduleEnabled(config, "agenda")) && (c.id !== "tk" || moduleEnabled(config, "taches")) && (!c.id.startsWith("go-") || moduleEnabled(config, c.id.slice(3) as RucheSearch["app"]));
    return [...smart, ...found, ...base].filter(allowed);
  }, [vault, q, go, onClose, toast, config, nav]);

  const run = (i: number) => void commands[i]?.run();
  return (
    <Dialog open={open} onClose={onClose} title="Commandes" bare wide>
      <div className="ru-search mb-2">
        <Command className="h-5 w-5 shrink-0 text-[var(--ru-muted)]" aria-hidden />
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="Une action, un nom… ou « dentiste jeudi 9h »" aria-label="Commande" role="combobox" aria-expanded="true" aria-controls="ru-palette-list"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, commands.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); run(active); }
          }} />
        <kbd className="ru-kbd">Échap</kbd>
      </div>
      <ul id="ru-palette-list" role="listbox" className="max-h-[60vh] overflow-y-auto">
        {commands.map((c, i) => (
          <li key={`${c.id}-${i}`} role="option" aria-selected={i === active}>
            <button type="button" className="ru-palette-item" data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => run(i)}>
              <span className="grid h-8 w-8 shrink-0 place-items-center text-[var(--ru-muted)]">{c.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[14.5px]">{c.label}</span>
              {c.hint ? <span className="shrink-0 text-[12px] text-[var(--ru-muted)]">{c.hint}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
