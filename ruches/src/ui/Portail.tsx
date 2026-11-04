/**
 * Ruches — le portail devenu l'accueil de Ruches.
 * Une seule barre pour tout : tes contenus (sur l'appareil), Ruches Search, Qwant ou Lilo, les raccourcis « ! »,
 * les calculs instantanés et les services français du quotidien. Indépendant de l'hôte : ce qui est propre à un
 * site (actualités, assistant, applis, compte) arrive par des emplacements (slots).
 * Licence AGPL-3.0 (projet Ruches).
 */
import { useContext, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight, Calculator, CalendarDays, ChevronDown, CircleCheck, Clock, CloudSun, Command, ExternalLink, FilePlus2, Globe, HardDrive, History, Images, LayoutGrid,
  Map as MapIcon, MapPin, Mic, Newspaper, Search, ShieldCheck, Sheet, Sparkles, Upload, Video, X, Zap,
} from "lucide-react";
import { BANGS, ENGINES, SEARCH_KINDS, bangHints, engineUrl, instantAnswer, parseQuery, type EngineId, type SearchKind } from "../core/bangs";
import { emptySheet } from "../core/sheet";
import { fold, type RucheNode } from "../core/vault";
import {
  forumCommunities, goodCauses, mailGroups, messagingGroups, musicGroups, radioGroups, radioStations, routeGroups, services, tvGroups, usefulGroups,
  type LinkGroup, type PanelServiceKey, type Service,
} from "../portail/catalogue";
import { Dialog, ThemeContext, useToast } from "./kit";
import { ago, dayStart, formatWhen, KIND_LABEL, NodeBadge, openTarget, reachable, useConfig, useModules, useVault, type RucheNav } from "./shared";

export type PortalSlots = {
  /** Sous la barre de recherche (applis du site, vitrine…). */
  afterSearch?: ReactNode;
  /** Colonne de droite sur ordinateur, sous le reste sur téléphone (actualités…). */
  aside?: ReactNode;
  /** Bas de page (avis, liens…). */
  end?: ReactNode;
  /** Assistant conversationnel fourni par l'hôte (panneau « IA »). */
  assistant?: ReactNode;
};

export type PortalHost = {
  slots?: PortalSlots;
  /** Moteur choisi par la personne (préférence du compte côté hôte). */
  engine?: EngineId;
  onEngineChange?: (engine: EngineId) => void;
  /** Prénom affiché dans le bonjour. */
  name?: string | null;
};

const HISTORY_KEY = "openruches-history";
const ENGINE_KEY = "openruches-engine";
const COORDS_KEY = "openruches-weather-coords";
const HINTS = ["Chercher sans pistage", "!w Victor Hugo", "Météo du week-end", "15 % de 80", "!sp carte grise", "Un film pour ce soir", "? facture", "!trad bonjour"];

const PANEL_TITLES: Record<PanelServiceKey | "bangs" | "about", string> = {
  forum: "Réseaux & forums français",
  useful: "Sites utiles en France",
  good: "Bonne action",
  radio: "Radios & podcasts français",
  tv: "Télévision française",
  mail: "Messageries e-mail",
  messages: "Messageries instantanées",
  routes: "Itinéraires & cartes",
  music: "Musique en ligne",
  ai: "Assistant",
  bangs: "Raccourcis « ! »",
  about: "À propos d’Ruches",
};

const KIND_ICON: Record<SearchKind, typeof Search> = { all: Search, news: Newspaper, images: Images, videos: Video, maps: MapIcon };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : la valeur reste pour la session */
  }
}

function greeting(hour: number) {
  if (hour < 5) return "Bonne nuit";
  if (hour < 18) return "Bonjour";
  return "Bonsoir";
}

// Codes météo WMO → libellé court (Open-Meteo).
function weatherLabel(code: number) {
  if (code === 0) return "Ciel dégagé";
  if (code <= 2) return "Éclaircies";
  if (code === 3) return "Couvert";
  if (code <= 48) return "Brouillard";
  if (code <= 57) return "Bruine";
  if (code <= 67) return "Pluie";
  if (code <= 77) return "Neige";
  if (code <= 82) return "Averses";
  return "Orage";
}

/** Météo locale à la demande : position arrondie (~1 km), gardée sur l'appareil, prévision Open-Meteo. */
function useWeather() {
  const [weather, setWeather] = useState<{ temperature: number; label: string } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied" | "ready">("idle");
  const load = async (lat: number, lon: number) => {
    setState("loading");
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,weather_code&timezone=auto`;
      const data = (await (await fetch(url)).json()) as { current?: { temperature_2m?: number; weather_code?: number } };
      if (typeof data.current?.temperature_2m !== "number") throw new Error("météo indisponible");
      setWeather({ temperature: Math.round(data.current.temperature_2m), label: weatherLabel(data.current.weather_code ?? 0) });
      setState("ready");
    } catch {
      setState("idle");
    }
  };
  useEffect(() => {
    const saved = readJson<{ lat: number; lon: number } | null>(COORDS_KEY, null);
    if (saved && typeof saved.lat === "number" && typeof saved.lon === "number") void load(saved.lat, saved.lon);
  }, []);
  const request = () => {
    if (!("geolocation" in navigator)) return setState("denied");
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const coords = { lat: Number(p.coords.latitude.toFixed(2)), lon: Number(p.coords.longitude.toFixed(2)) };
        writeJson(COORDS_KEY, coords);
        void load(coords.lat, coords.lon);
      },
      () => setState("denied"),
      { maximumAge: 30 * 60_000, timeout: 10_000 },
    );
  };
  return { weather, state, request };
}

/** Web Speech API : absente des types DOM de TypeScript, on décrit seulement ce qui est utilisé. */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

type Suggestion = {
  id: string;
  kind: "answer" | "bang" | "content" | "history" | "remote" | "service";
  label: string;
  detail?: string;
  run: () => void;
  icon: ReactNode;
  removable?: string;
};

/** `module` : ouvert comme module « Web » (l'accueil reste celui de Ruches) — pas de résumé de la Ruche en double. */
export function Portail({ go, onPalette, host, module = false }: { go: RucheNav; onPalette: () => void; host?: PortalHost; module?: boolean }) {
  const config = useConfig();
  const { vault, tick } = useVault();
  const toast = useToast();
  const reduce = useReducedMotion();
  const mode = useContext(ThemeContext);
  const slots = host?.slots ?? {};
  const portal = config.portal;

  const [now, setNow] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [kind, setKind] = useState<SearchKind>("all");
  const [highlight, setHighlight] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const [remote, setRemote] = useState<string[]>([]);
  const [engine, setEngineState] = useState<EngineId>(host?.engine ?? portal?.defaultEngine ?? "qwant");
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [panel, setPanel] = useState<PanelServiceKey | "bangs" | "about" | null>(null);
  const [allShortcuts, setAllShortcuts] = useState(false);
  const [hint, setHint] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const { weather, state: weatherState, request: requestWeather } = useWeather();

  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    const saved = readJson<unknown>(HISTORY_KEY, []);
    setHistory(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string").slice(0, 12) : []);
    if (!host?.engine) {
      const stored = readJson<unknown>(ENGINE_KEY, null);
      if (stored === "qwant" || stored === "lilo" || stored === "ruches") setEngineState(stored);
    }
    return () => window.clearInterval(t);
  }, [host?.engine]);

  useEffect(() => {
    if (host?.engine) setEngineState(host.engine);
  }, [host?.engine]);

  useEffect(() => {
    if (focused || query || reduce) return;
    const t = window.setInterval(() => setHint((h) => (h + 1) % HINTS.length), 3200);
    return () => window.clearInterval(t);
  }, [focused, query, reduce]);

  // Suggestions de saisie : seulement si l'hôte fournit un relais, et jamais pour un raccourci ou une recherche locale.
  useEffect(() => {
    const q = query.trim();
    const parsed = parseQuery(q);
    if (!portal?.suggest || q.length < 2 || parsed.kind !== "plain" || engine === "ruches") {
      setRemote([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      portal.suggest!(q, controller.signal)
        .then((items) => !controller.signal.aborted && setRemote(items.slice(0, 6)))
        .catch(() => !controller.signal.aborted && setRemote([]));
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, portal, engine]);

  useEffect(() => setHighlight(-1), [query]);

  const chooseEngine = (next: EngineId) => {
    setEngineState(next);
    writeJson(ENGINE_KEY, next);
    host?.onEngineChange?.(next);
  };

  const remember = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setHistory((current) => {
      const next = [clean, ...current.filter((x) => x !== clean)].slice(0, 12);
      writeJson(HISTORY_KEY, next);
      return next;
    });
  };
  const forget = (value: string) =>
    setHistory((current) => {
      const next = current.filter((x) => x !== value);
      writeJson(HISTORY_KEY, next);
      return next;
    });

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /** Lance une recherche selon la saisie : raccourci, recherche dans Ruches, ou moteur choisi. */
  const submit = (value: string, chosen: SearchKind = kind) => {
    const parsed = parseQuery(value);
    if (parsed.kind === "bang") {
      remember(value);
      openExternal(parsed.url);
      return;
    }
    const q = parsed.query.trim();
    if (!q) return;
    remember(value);
    if (parsed.kind === "local" || (engine === "ruches" && chosen === "all")) {
      go({ app: "recherche", q });
      return;
    }
    openExternal(engineUrl(engine === "lilo" ? "lilo" : "qwant", q, chosen));
  };

  const contentMatches = useMemo<RucheNode[]>(() => {
    const q = parseQuery(query).query.trim();
    if (!vault || q.length < 2) return [];
    return vault.search(q, 6).map((r) => r.node).filter((node) => reachable(config, node)).slice(0, 4);
    // tick : le coffre a changé
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, query, config, tick]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const raw = query.trim();
    const q = fold(raw);
    const out: Suggestion[] = [];
    const answer = instantAnswer(raw);
    if (answer !== null) out.push({ id: "answer", kind: "answer", label: `= ${answer}`, detail: "Calcul fait sur l’appareil", icon: <Calculator className="h-4 w-4" aria-hidden />, run: () => { void navigator.clipboard?.writeText(answer).then(() => toast.ok("Résultat copié")).catch(() => undefined); } });
    for (const { key, bang } of bangHints(raw, 4)) out.push({ id: `bang-${key}`, kind: "bang", label: `!${key}`, detail: bang.label, icon: <Zap className="h-4 w-4" aria-hidden />, run: () => { setQuery(`${raw.replace(/[!&][\p{L}\p{N}]*$/u, "")}!${key} `); input.current?.focus(); } });
    const parsed = parseQuery(raw);
    if (parsed.kind === "bang") out.push({ id: "bang-go", kind: "bang", label: parsed.query ? `${parsed.bang.label} : « ${parsed.query} »` : `Ouvrir ${parsed.bang.label}`, detail: "Raccourci", icon: <ArrowUpRight className="h-4 w-4" aria-hidden />, run: () => submit(raw) });
    for (const node of contentMatches) out.push({ id: `node-${node.id}`, kind: "content", label: node.name, detail: `${KIND_LABEL[node.kind]} · dans ta Ruche`, icon: <NodeBadge node={node} size={24} />, run: () => go(openTarget(node)) });
    if (q && parsed.kind === "plain") {
      for (const service of services.filter((s) => fold(s.name).includes(q) || (s.keywords ?? []).some((k) => fold(k).includes(q))).slice(0, 3)) {
        out.push({ id: `svc-${service.name}`, kind: "service", label: service.name, detail: service.description, icon: <service.icon className="h-4 w-4" style={{ color: service.accent }} aria-hidden />, run: () => openService(service) });
      }
    }
    for (const item of history.filter((h) => !q || fold(h).includes(q)).slice(0, q ? 3 : 6)) out.push({ id: `h-${item}`, kind: "history", label: item, icon: <History className="h-4 w-4" aria-hidden />, run: () => { setQuery(item); submit(item); }, removable: item });
    for (const item of remote) if (!out.some((s) => s.label === item)) out.push({ id: `r-${item}`, kind: "remote", label: item, icon: <Search className="h-4 w-4" aria-hidden />, run: () => { setQuery(item); submit(item); } });
    return out.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, history, remote, contentMatches, engine, kind]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1)); }
    else if (e.key === "Escape") { setFocused(false); input.current?.blur(); }
    else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); suggestions[highlight]?.run(); }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(query);
  };

  const voice = () => {
    if (listening) return;
    setVoiceMessage("");
    const w = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return setVoiceMessage("La recherche vocale n’est pas prise en charge par ce navigateur.");
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setVoiceMessage("Impossible d’utiliser le micro pour le moment."); };
    rec.onresult = (event) => {
      setListening(false);
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      if (!text) return;
      setQuery(text);
      submit(text);
    };
    try { rec.start(); } catch { setListening(false); setVoiceMessage("Impossible de démarrer la recherche vocale."); }
  };

  function openService(service: Service) {
    if (service.panel === "ai" && !slots.assistant) return openExternal("https://www.qwant.com/ai?l=fr");
    if (service.panel) return setPanel(service.panel);
    openExternal(service.url);
  }

  const newDoc = async () => vault && go({ app: "plume", id: (await vault.createContent(null, "doc", "Document sans titre", "")).id });
  const newSheet = async () => vault && go({ app: "grille", id: (await vault.createContent(null, "sheet", "Grille sans titre", JSON.stringify(emptySheet()))).id });

  const shortcuts = useMemo(() => {
    const first = ["Météo", "Mail", "Radio", "TV", "IA", "Itinéraires", "Musique", "Sites utiles"];
    const rank = (n: string) => { const i = first.indexOf(n); return i < 0 ? first.length : i; };
    return [...services].sort((a, b) => rank(a.name) - rank(b.name));
  }, []);

  const date = now?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) ?? "";
  const KindIcon = KIND_ICON[kind];
  const showSuggestions = focused && suggestions.length > 0;
  const engineLabel = ENGINES.find((e) => e.id === engine)?.label ?? "Qwant";

  return (
    <div className="ru-portail grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
      <div className="min-w-0 space-y-8">
        {/* Bonjour, date, météo */}
        <section aria-label="En un coup d’œil" className="pt-2">
          <p className="text-[clamp(1rem,3.4vw,1.2rem)] font-medium text-[var(--ru-muted)]">
            {now ? `${greeting(now.getHours())}${host?.name ? `, ${host.name}` : ""}` : " "} {now ? <span aria-hidden>👋</span> : null}
          </p>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-0.5 text-[clamp(1.9rem,7.5vw,2.7rem)] font-normal leading-[1.08] tracking-[-.02em] first-letter:uppercase">
            {date || " "}
          </motion.h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
            {weather ? (
              <span className="ru-chip !cursor-default"><CloudSun className="h-4 w-4" style={{ color: "var(--ru-honey-deep)" }} aria-hidden /> {weather.temperature} °C · {weather.label}</span>
            ) : weatherState === "denied" ? null : (
              <button type="button" className="ru-chip" onClick={requestWeather} disabled={weatherState === "loading"}><MapPin className="h-4 w-4" aria-hidden /> {weatherState === "loading" ? "Localisation…" : "Météo locale"}</button>
            )}
            <button type="button" className="ru-chip" onClick={onPalette}><Command className="h-4 w-4" aria-hidden /> Commandes <kbd className="ru-kbd max-lg:hidden">Ctrl K</kbd></button>
          </div>
        </section>

        {/* La barre unique */}
        <section aria-label="Recherche">
          <form role="search" onSubmit={onSubmit} className="relative">
            <motion.div animate={{ scale: focused && !reduce ? 1.01 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="ru-card relative overflow-visible !rounded-[30px]" style={{ boxShadow: focused ? "0 10px 40px color-mix(in srgb, var(--ru-honey) 22%, transparent)" : undefined }}>
              <div className="flex h-[60px] items-center gap-1 px-4 sm:gap-2 sm:px-5">
                <KindIcon className="h-5 w-5 shrink-0 text-[var(--ru-muted)]" aria-hidden />
                <div className="relative min-w-0 flex-1">
                  <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => { setFocused(false); setHighlight(-1); }, 150)} onKeyDown={onKeyDown}
                    className="h-[56px] w-full bg-transparent px-1 text-[16px] outline-none" aria-label={`Chercher dans ta Ruche ou sur le web avec ${engineLabel}`} autoComplete="off" enterKeyHint="search"
                    role="combobox" aria-expanded={showSuggestions} aria-controls="ru-portail-suggest" aria-activedescendant={highlight >= 0 ? `ru-sg-${highlight}` : undefined} />
                  {!query ? <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1 flex items-center truncate text-[16px] text-[var(--ru-muted)]">{HINTS[hint]}</span> : null}
                </div>
                {query ? <button type="button" className="ru-icon-btn !h-10 !w-10" aria-label="Effacer" onClick={() => { setQuery(""); input.current?.focus(); }}><X className="h-5 w-5" aria-hidden /></button> : null}
                <button type="button" className="ru-icon-btn !h-10 !w-10" onClick={voice} aria-label="Recherche vocale" title="Recherche vocale">
                  {listening ? <span className="flex gap-[3px]" aria-hidden><span className="h-[5px] w-[5px] animate-bounce rounded-full bg-[var(--ru-honey-deep)]" /><span className="h-[5px] w-[5px] animate-bounce rounded-full bg-[var(--ru-honey-deep)] [animation-delay:.15s]" /><span className="h-[5px] w-[5px] animate-bounce rounded-full bg-[var(--ru-honey-deep)] [animation-delay:.3s]" /></span> : <Mic className="h-5 w-5" style={{ color: "var(--ru-blue)" }} aria-hidden />}
                </button>
              </div>
              {showSuggestions ? (
                <ul id="ru-portail-suggest" role="listbox" aria-label="Suggestions" className="border-t border-[var(--ru-line)] pb-2 pt-1">
                  {suggestions.map((s, i) => (
                    <li key={s.id} id={`ru-sg-${i}`} role="option" aria-selected={i === highlight} className="flex items-center" style={{ background: i === highlight ? "var(--ru-surface-2)" : undefined }}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHighlight(i)} onClick={s.run} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-4 text-left text-[15px]">
                        <span className="grid w-6 shrink-0 place-items-center text-[var(--ru-muted)]">{s.icon}</span>
                        <span className="min-w-0 flex-1 truncate"><span className={s.kind === "answer" || s.kind === "service" ? "font-semibold" : undefined}>{s.label}</span>{s.detail ? <span className="text-[var(--ru-muted)]"> — {s.detail}</span> : null}</span>
                      </button>
                      {s.removable ? <button type="button" className="ru-icon-btn mr-2 !h-9 !w-9" aria-label={`Oublier ${s.removable}`} onMouseDown={(e) => e.preventDefault()} onClick={() => forget(s.removable!)}><X className="h-4 w-4" aria-hidden /></button> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </motion.div>
          </form>
          {voiceMessage ? <p className="mt-2 text-center text-[12.5px] text-[var(--ru-muted)]">{voiceMessage}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-[var(--ru-surface-2)] p-1" role="radiogroup" aria-label="Moteur de recherche">
              {ENGINES.map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={engine === e.id} title={e.note} className="ru-chip !min-h-9 !px-3 !text-[13.5px]" data-strong={engine === e.id} onClick={() => chooseEngine(e.id)}>
                  {e.id === "ruches" ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> : <Globe className="h-3.5 w-3.5" aria-hidden />} {e.label}
                </button>
              ))}
            </div>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label="Type de recherche">
              {SEARCH_KINDS.map((k) => (
                <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className="ru-chip !min-h-9 shrink-0 !px-3 !text-[13.5px]" data-strong={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
              ))}
            </div>
            <button type="button" className="ru-chip !min-h-9 !px-3 !text-[13.5px]" onClick={() => setPanel("bangs")}><Zap className="h-3.5 w-3.5" aria-hidden /> Raccourcis !</button>
          </div>
          <p className="mt-2 px-1 text-[12px] text-[var(--ru-muted)]">
            {engine === "ruches" ? "Ruches : tes contenus et notre index, classés sur ton appareil. Rien n’est envoyé." : `${engineLabel} : la recherche s’ouvre chez ${engineLabel}, qui applique ses règles. Tes contenus, eux, sont cherchés sur l’appareil.`}
          </p>
        </section>

        {slots.afterSearch ? <div>{slots.afterSearch}</div> : null}

        {/* Ta Ruche */}
        {vault && !module ? <RucheSummary go={go} onNewDoc={newDoc} onNewSheet={newSheet} /> : null}

        {/* Raccourcis du quotidien */}
        <section aria-labelledby="ru-shortcuts-title">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <h2 id="ru-shortcuts-title" className="text-[18px] font-medium">Raccourcis</h2>
            <button type="button" className="ru-chip !min-h-9 !text-[13px]" aria-expanded={allShortcuts} onClick={() => setAllShortcuts((v) => !v)}>
              {allShortcuts ? "Moins" : `Tout voir (${shortcuts.length})`} <ChevronDown className={`h-4 w-4 transition-transform ${allShortcuts ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </div>
          <div className="ru-card grid grid-cols-4 justify-items-center gap-y-5 px-2 py-5 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8">
            {(allShortcuts ? shortcuts : shortcuts.slice(0, 8)).map((service, i) => (
              <motion.button key={service.name} type="button" title={service.description} onClick={() => openService(service)}
                initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
                className="group flex w-[72px] flex-col items-center gap-1.5 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-[18px] transition group-hover:rounded-[14px] group-active:scale-90" style={{ background: `color-mix(in srgb, ${service.accent} ${mode === "dark" ? 26 : 14}%, transparent)`, color: mode === "dark" ? "var(--ru-text)" : service.accent }}>
                  <service.icon className="h-[22px] w-[22px]" aria-hidden />
                </span>
                <span className="line-clamp-2 text-[12px] font-medium leading-tight">{service.name}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {slots.end ? <div>{slots.end}</div> : null}

        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-4 text-center text-[12.5px] text-[var(--ru-muted)]">
          <span>{config.name} · libre (AGPL-3.0)</span>
          <button type="button" className="underline underline-offset-2" onClick={() => setPanel("about")}>À propos et confidentialité</button>
          <button type="button" className="underline underline-offset-2" onClick={() => go(module ? {} : { app: "ruche" })}>Ma Ruche</button>
        </footer>
      </div>

      {slots.aside ? <aside className="min-w-0 lg:pt-2">{slots.aside}</aside> : null}

      <Dialog open={!!panel} onClose={() => setPanel(null)} title={panel ? PANEL_TITLES[panel] : ""} wide={panel === "ai" || panel === "bangs"}>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {panel === "radio" ? (
            <div className="space-y-4">
              <LinkGroups groups={radioGroups} />
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ru-muted)]">Accès rapides</p>
                <div className="flex flex-wrap gap-2">{radioStations.map((s) => <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="ru-chip !min-h-9 !text-[13px]">{s.name}</a>)}</div>
              </div>
            </div>
          ) : panel === "tv" ? <LinkGroups groups={tvGroups} />
          : panel === "mail" ? <LinkGroups groups={mailGroups} />
          : panel === "messages" ? <LinkGroups groups={messagingGroups} />
          : panel === "routes" ? <LinkGroups groups={routeGroups} />
          : panel === "music" ? <LinkGroups groups={musicGroups} />
          : panel === "useful" ? <LinkGroups groups={usefulGroups.map((g) => ({ title: g.title, items: g.items }))} />
          : panel === "forum" ? <LinkGroups groups={[{ title: "Communautés françaises", items: forumCommunities }]} />
          : panel === "good" ? <LinkGroups groups={[{ title: "Associations", items: goodCauses }]} />
          : panel === "ai" ? (slots.assistant ?? null)
          : panel === "bangs" ? <BangsList />
          : panel === "about" ? <About name={config.name} />
          : null}
          {panel && panel !== "ai" && panel !== "bangs" && panel !== "about" ? <p className="mt-4 text-center text-[11.5px] text-[var(--ru-muted)]">{config.name} n’est affilié à aucun de ces services : chaque lien ouvre le site de l’éditeur.</p> : null}
        </div>
      </Dialog>
    </div>
  );
}

function LinkGroups({ groups }: { groups: LinkGroup[] }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.title} className={`space-y-2 ${group.secondary ? "opacity-90" : ""}`}>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ru-muted)]">{group.title}</p>
          {group.items.map((item) => (
            <a key={item.name} href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-2xl border p-3 transition hover:bg-[var(--ru-surface-2)]"
              style={{ borderColor: item.recommended ? "var(--ru-honey)" : "var(--ru-line)", background: item.recommended ? "var(--ru-honey-soft)" : undefined }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${item.accent} 16%, transparent)`, color: item.accent }}><item.icon className="h-5 w-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-medium">{item.name}</span>
                  <span className="rounded-full bg-[var(--ru-surface-3)] px-2 py-[1px] text-[11px]">{item.badge}</span>
                  {item.recommended ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[11px] font-semibold" style={{ color: "var(--ru-honey-deep)" }}><ShieldCheck className="h-3 w-3" aria-hidden /> Recommandé</span> : null}
                </span>
                <span className="mt-1 block text-[13px] leading-5 text-[var(--ru-muted)]">{item.description}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--ru-blue)" }}><ExternalLink className="h-3 w-3" aria-hidden /> {item.host}</span>
              </span>
            </a>
          ))}
          {group.note ? <p className="text-[12px] leading-4 text-[var(--ru-muted)]">{group.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function BangsList() {
  return (
    <div>
      <p className="mb-3 text-[14px] text-[var(--ru-muted)]">Tape un raccourci au début ou à la fin de ta recherche, par exemple <code className="ru-kbd !inline">!w Victor Hugo</code> ou <code className="ru-kbd !inline">carte grise !sp</code>. Le signe <code className="ru-kbd !inline">&amp;</code> marche aussi. Commence par <code className="ru-kbd !inline">?</code> pour chercher seulement dans ta Ruche.</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {BANGS.map((b) => (
          <li key={b.label} className="ru-row !min-h-11">
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{b.label}</span>
            <span className="flex shrink-0 gap-1">{b.keys.slice(0, 3).map((k) => <code key={k} className="ru-kbd !inline-grid">!{k}</code>)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function About({ name }: { name: string }) {
  return (
    <div className="space-y-3 text-[14px] leading-6 text-[var(--ru-muted)]">
      <p><strong className="font-semibold text-[var(--ru-text)]">{name}</strong> réunit deux projets : le portail Ruches (recherche sans pistage et services français du quotidien) et Ruches (fichiers, documents, grilles, agenda, tâches et espaces sur ton appareil). Projet libre sous licence AGPL-3.0.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong className="font-medium text-[var(--ru-text)]">Tes contenus</strong> restent sur l’appareil : la recherche dedans est faite localement, rien n’est envoyé.</li>
        <li><strong className="font-medium text-[var(--ru-text)]">Moteur « Ruches »</strong> : notre index public et tes contenus, classés dans ton navigateur, sans historique côté serveur.</li>
        <li><strong className="font-medium text-[var(--ru-text)]">Qwant ou Lilo</strong> : ta requête est envoyée au moteur choisi, qui applique ses propres règles. Les cartes passent par cartes.gouv.fr (IGN).</li>
        <li><strong className="font-medium text-[var(--ru-text)]">Raccourcis « ! » et calculs</strong> : calculés sur l’appareil ; seul le site d’arrivée reçoit la requête.</li>
        <li><strong className="font-medium text-[var(--ru-text)]">Historique de recherche et météo</strong> : gardés sur l’appareil (position arrondie à ~1 km), effaçables à tout moment.</li>
        <li><strong className="font-medium text-[var(--ru-text)]">Recherche vocale</strong> : reconnaissance de ton navigateur ou de ton appareil ; l’audio peut être traité par leur fournisseur.</li>
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <a href="https://about.qwant.com/legal/confidentialite/" target="_blank" rel="noreferrer" style={{ color: "var(--ru-blue)" }}>Confidentialité Qwant</a>
        <a href="https://www.lilo.org/politique-de-confidentialite/" target="_blank" rel="noreferrer" style={{ color: "var(--ru-blue)" }}>Confidentialité Lilo</a>
        <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer" style={{ color: "var(--ru-blue)" }}>Open-Meteo</a>
      </p>
    </div>
  );
}

/** Résumé de la Ruche sur l'accueil : créer, aujourd'hui, récents, place. */
function RucheSummary({ go, onNewDoc, onNewSheet }: { go: RucheNav; onNewDoc: () => void; onNewSheet: () => void }) {
  const { vault } = useVault();
  const config = useConfig();
  const mods = useModules();
  if (!vault) return null;
  const startToday = dayStart(0);
  const events = !mods.on("agenda") ? [] : vault.objects("event").filter((e) => typeof e.props?.start === "number" && (e.props.start as number) >= startToday).sort((a, b) => (a.props!.start as number) - (b.props!.start as number)).slice(0, 3);
  const tasks = !mods.on("taches") ? [] : vault.objects("task").filter((t) => !t.props?.done).sort((a, b) => ((a.props?.due as number) ?? Infinity) - ((b.props?.due as number) ?? Infinity)).slice(0, 3);
  const recent = vault.recent(12).filter((n) => reachable(config, n)).slice(0, 4);
  const stats = vault.stats();
  return (
    <section aria-labelledby="ru-summary-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 id="ru-summary-title" className="text-[18px] font-medium">Ta Ruche</h2>
        <button type="button" className="ru-chip !min-h-9 !text-[13px]" onClick={() => go({ app: "ruche" })}><HardDrive className="h-4 w-4" aria-hidden /> {stats.files} élément{stats.files > 1 ? "s" : ""} · gérer</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {mods.on("fichiers") ? <button type="button" className="ru-chip" data-strong="true" onClick={() => go({ app: "fichiers" })}><Upload className="h-4 w-4" aria-hidden /> Fichiers</button> : null}
        {mods.on("plume") ? <button type="button" className="ru-chip" onClick={onNewDoc}><FilePlus2 className="h-4 w-4" style={{ color: "#3b82f6" }} aria-hidden /> Document</button> : null}
        {mods.on("grille") ? <button type="button" className="ru-chip" onClick={onNewSheet}><Sheet className="h-4 w-4" style={{ color: "#16a34a" }} aria-hidden /> Grille</button> : null}
        {mods.on("agenda") ? <button type="button" className="ru-chip" onClick={() => go({ app: "agenda" })}><CalendarDays className="h-4 w-4" style={{ color: "var(--ru-violet)" }} aria-hidden /> Agenda</button> : null}
        {mods.on("taches") ? <button type="button" className="ru-chip" onClick={() => go({ app: "taches" })}><CircleCheck className="h-4 w-4" style={{ color: "#0891b2" }} aria-hidden /> Tâches</button> : null}
        {mods.on("espaces") ? <button type="button" className="ru-chip" onClick={() => go({ app: "espaces" })}><LayoutGrid className="h-4 w-4" style={{ color: "var(--ru-honey-deep)" }} aria-hidden /> Espaces</button> : null}
      </div>
      {events.length || tasks.length || recent.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {events.length || tasks.length ? (
            <div className="ru-card p-4">
              <h3 className="mb-1 flex items-center gap-2 px-1 text-[14.5px] font-semibold"><Clock className="h-4 w-4" style={{ color: "var(--ru-violet)" }} aria-hidden /> Bientôt</h3>
              <ul>
                {events.map((e) => <li key={e.id}><button type="button" className="ru-row w-full !min-h-[46px] text-left" onClick={() => go(openTarget(e))}><CalendarDays className="h-4 w-4 shrink-0 text-[var(--ru-violet)]" aria-hidden /><span className="min-w-0 flex-1 truncate text-[14px] font-medium">{e.name}</span><span className="shrink-0 text-[12px] text-[var(--ru-muted)]">{formatWhen(e.props!.start as number, e.props!.allDay as boolean)}</span></button></li>)}
                {tasks.map((t) => <li key={t.id}><button type="button" className="ru-row w-full !min-h-[46px] text-left" onClick={() => go(openTarget(t))}><CircleCheck className="h-4 w-4 shrink-0 text-[#0891b2]" aria-hidden /><span className="min-w-0 flex-1 truncate text-[14px] font-medium">{t.name}</span>{typeof t.props?.due === "number" ? <span className={`shrink-0 text-[12px] ${(t.props.due as number) < startToday ? "font-semibold text-[var(--ru-danger)]" : "text-[var(--ru-muted)]"}`}>{(t.props.due as number) < startToday ? "en retard" : formatWhen(t.props.due as number, true)}</span> : null}</button></li>)}
              </ul>
            </div>
          ) : null}
          {recent.length ? (
            <div className="ru-card p-4">
              <h3 className="mb-1 flex items-center gap-2 px-1 text-[14.5px] font-semibold"><Sparkles className="h-4 w-4" style={{ color: "var(--ru-honey-deep)" }} aria-hidden /> Récents</h3>
              <ul>{recent.map((n) => <li key={n.id}><button type="button" className="ru-row w-full !min-h-[46px] text-left" onClick={() => go(openTarget(n))}><NodeBadge node={n} size={26} /><span className="min-w-0 flex-1 truncate text-[14px] font-medium">{n.name}</span><span className="shrink-0 text-[12px] text-[var(--ru-muted)]">{ago(n.updated)}</span></button></li>)}</ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="ru-card p-4 text-[14px] text-[var(--ru-muted)]">Ta Ruche est vide : importe un fichier, écris un document ou tape « dentiste jeudi 9h » dans les commandes.</p>
      )}
    </section>
  );
}
