/**
 * Modules à objets structurés : Agenda, Tâches, Espaces.
 * Tous lisent le même coffre : une tâche avec échéance apparaît aussi dans l'agenda (même donnée, autre vue),
 * un espace ne contient que des références (aucune copie).
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Circle, CircleCheck, ExternalLink, FilePlus2, Hexagon, MapPin, Plus, Search, Sheet, Trash2 } from "lucide-react";
import { detectDates } from "../core/detect";
import { emptySheet } from "../core/sheet";
import { fold, type RucheNode } from "../core/vault";
import { NameDialog } from "./dialogs";
import { Confirm, Dialog, useToast } from "./kit";
import { dayStart, formatWhen, KIND_LABEL, NodeBadge, openTarget, safeColor, useModules, useVault, type RucheNav, type RucheSearch } from "./shared";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
export const toDateInput = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const toTimeInput = (ts: number) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromInputs = (date: string, time: string) => { const [y, m, d] = date.split("-").map(Number); const [hh, mm] = time ? time.split(":").map(Number) : [0, 0]; return new Date(y, m - 1, d, hh, mm).getTime(); };
const startOfDay = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

const SPACE_COLORS = ["#ea580c", "#2563eb", "#16a34a", "#7c3aed", "#db2777", "#0891b2"];

function Header({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[clamp(1.6rem,5vw,2.2rem)] font-semibold tracking-[-.02em]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] text-[var(--ru-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

// ——— Événement : création et modification ———

export function EventDialog({ node, initial, open, onClose, go, spaces = [] }: { node?: RucheNode | null; initial?: { name?: string; start?: number; allDay?: boolean }; open: boolean; onClose: () => void; go: RucheNav; spaces?: string[] }) {
  const { vault } = useVault();
  const mods = useModules();
  const toast = useToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!open) return;
    const start = (node?.props?.start as number | undefined) ?? initial?.start ?? Date.now() + DAY;
    const allDay = (node?.props?.allDay as boolean | undefined) ?? initial?.allDay ?? !initial?.start;
    setName(node?.name ?? initial?.name ?? "");
    setDate(toDateInput(start));
    setTime(allDay ? "" : toTimeInput(start));
    setPlace((node?.props?.place as string | undefined) ?? "");
    setNotes((node?.props?.notes as string | undefined) ?? "");
  }, [open, node, initial]);
  if (!vault) return null;
  const linked = node?.props?.source ? vault.node(node.props.source as string) : undefined;
  const source = linked && mods.reachable(linked) ? linked : undefined;
  const save = async () => {
    if (!name.trim() || !date) return;
    const props = { start: fromInputs(date, time), allDay: !time, place: place.trim() || undefined, notes: notes.trim() || undefined };
    if (node) await vault.updateObject(node.id, { name, props });
    else await vault.createObject("event", name, props, spaces);
    toast.ok(node ? "Événement mis à jour" : `Événement ajouté : ${formatWhen(props.start, props.allDay)}`);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title={node ? "Événement" : "Nouvel événement"}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div><label className="ru-label" htmlFor="ev-name">Titre</label><input id="ev-name" className="ru-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus required /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="ru-label" htmlFor="ev-date">Date</label><input id="ev-date" type="date" className="ru-field" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><label className="ru-label" htmlFor="ev-time">Heure (vide = journée)</label><input id="ev-time" type="time" className="ru-field" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div><label className="ru-label" htmlFor="ev-place">Lieu</label><input id="ev-place" className="ru-field" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={300} /></div>
        <div><label className="ru-label" htmlFor="ev-notes">Notes</label><textarea id="ev-notes" className="ru-field" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} /></div>
        {source ? <button type="button" className="ru-chip" onClick={() => { onClose(); go(openTarget(source)); }}><ExternalLink className="h-4 w-4" aria-hidden /> Source : {source.name}</button> : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          {node ? <button type="button" className="ru-icon-btn" aria-label="Mettre à la corbeille" title="Mettre à la corbeille" onClick={() => setConfirm(true)}><Trash2 className="h-5 w-5" aria-hidden /></button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="ru-chip" onClick={onClose}>Annuler</button>
            <button type="submit" className="ru-chip" data-strong="true" disabled={!name.trim() || !date}>{node ? "Enregistrer" : "Ajouter"}</button>
          </div>
        </div>
      </form>
      <Confirm open={confirm} title="Mettre cet événement à la corbeille ?" text="Tu pourras le restaurer depuis la corbeille." confirm="Mettre à la corbeille" onCancel={() => setConfirm(false)} onConfirm={async () => { if (node) await vault.trash(node.id); setConfirm(false); onClose(); }} />
    </Dialog>
  );
}

// ——— Agenda ———

export function Agenda({ search, go }: { search: RucheSearch; go: RucheNav }) {
  const { vault } = useVault();
  const mods = useModules();
  const [creating, setCreating] = useState<{ start?: number; allDay?: boolean } | null>(null);
  const now = Date.now();
  const [y, m] = (search.mois ?? "").split("-").map(Number);
  const month = y && m ? new Date(y, m - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  if (!vault) return null;

  const events = vault.objects("event").filter((n) => typeof n.props?.start === "number");
  // Les échéances ne s'affichent que si le module Tâches est actif (sinon, liens sans destination).
  const tasks = !mods.on("taches") ? [] : vault.objects("task").filter((n) => typeof n.props?.due === "number" && !n.props?.done);
  const first = new Date(month);
  first.setDate(1 - ((month.getDay() + 6) % 7)); // lundi
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime());
  const on = (day: number) => [
    ...events.filter((e) => sameDay(e.props!.start as number, day)).sort((a, b) => (a.props!.start as number) - (b.props!.start as number)),
    ...tasks.filter((t) => sameDay(t.props!.due as number, day)),
  ];
  const upcoming = events.filter((e) => (e.props!.start as number) >= startOfDay(now)).sort((a, b) => (a.props!.start as number) - (b.props!.start as number)).slice(0, 12);
  const shift = (delta: number) => { const d = new Date(month.getFullYear(), month.getMonth() + delta, 1); go({ app: "agenda", mois: `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }, true); };
  const selected = search.id ? vault.node(search.id) : null;

  return (
    <section>
      <Header title="Agenda" subtitle="Tes événements, et les tâches qui ont une échéance." action={<button type="button" className="ru-chip" data-strong="true" onClick={() => setCreating({})}><CalendarPlus className="h-4 w-4" aria-hidden /> Événement</button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <button type="button" className="ru-icon-btn" aria-label="Mois précédent" onClick={() => shift(-1)}><ChevronLeft className="h-5 w-5" aria-hidden /></button>
            <h2 className="min-w-0 flex-1 text-[18px] font-semibold first-letter:uppercase">{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h2>
            <button type="button" className="ru-chip !min-h-9" onClick={() => go({ app: "agenda" }, true)}>Aujourd’hui</button>
            <button type="button" className="ru-icon-btn" aria-label="Mois suivant" onClick={() => shift(1)}><ChevronRight className="h-5 w-5" aria-hidden /></button>
          </div>
          <div className="ru-month mb-1 text-center text-[12px] font-semibold text-[var(--ru-muted)]" aria-hidden>{["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="ru-month" role="grid" aria-label="Mois">
            {days.map((day) => {
              const items = on(day);
              return (
                <button key={day} type="button" className="ru-day" data-out={new Date(day).getMonth() !== month.getMonth()} data-today={sameDay(day, now)} aria-label={`${new Date(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, ${items.length} élément${items.length > 1 ? "s" : ""}`}
                  onClick={() => (items.length === 1 ? go(openTarget(items[0])) : setCreating({ start: day + 9 * 3_600_000, allDay: true }))}>
                  <span className="ru-day-n">{new Date(day).getDate()}</span>
                  {items.slice(0, 3).map((n) => <span key={n.id} className="ru-dot" style={n.kind === "task" ? { background: "color-mix(in srgb, #0891b2 18%, transparent)" } : undefined}>{n.kind === "task" ? "✓ " : ""}{n.name}</span>)}
                  {items.length > 3 ? <span className="ru-dot">+{items.length - 3}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-[16px] font-semibold">À venir</h2>
          {upcoming.length ? (
            <ul className="space-y-1">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <button type="button" className="ru-row w-full text-left" onClick={() => go({ app: "agenda", id: e.id, mois: search.mois })}>
                    <span className="grid w-12 shrink-0 place-items-center rounded-2xl py-1.5 text-center" style={{ background: "var(--ru-honey-soft)" }}>
                      <span className="text-[11px] font-semibold uppercase text-[var(--ru-honey-deep)]">{new Date(e.props!.start as number).toLocaleDateString("fr-FR", { month: "short" })}</span>
                      <span className="text-[18px] font-semibold leading-none">{new Date(e.props!.start as number).getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{e.name}</span>
                      <span className="block truncate text-[12.5px] text-[var(--ru-muted)]">{formatWhen(e.props!.start as number, e.props!.allDay as boolean)}{e.props?.place ? ` · ${e.props.place}` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ru-card p-5 text-[14px] text-[var(--ru-muted)]">Rien de prévu. Astuce : dans un document, sélectionne une phrase avec une date (« réunion le 12 mars à 14h ») pour la transformer en événement.</p>
          )}
        </div>
      </div>
      <EventDialog open={!!creating || selected?.kind === "event"} node={selected?.kind === "event" ? selected : null} initial={creating ?? undefined} go={go}
        onClose={() => { setCreating(null); if (search.id) go({ app: "agenda", mois: search.mois }, true); }} />
    </section>
  );
}

// ——— Tâches ———

export function TaskDialog({ node, onClose, go }: { node: RucheNode | null; onClose: () => void; go: RucheNav }) {
  const { vault } = useVault();
  const mods = useModules();
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!node) return;
    setName(node.name);
    setDue(typeof node.props?.due === "number" ? toDateInput(node.props.due) : "");
    setNotes((node.props?.notes as string | undefined) ?? "");
  }, [node]);
  if (!vault) return null;
  const linked = node?.props?.source ? vault.node(node.props.source as string) : undefined;
  const source = linked && mods.reachable(linked) ? linked : undefined;
  return (
    <Dialog open={!!node} onClose={onClose} title="Tâche">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!node || !name.trim()) return; await vault.updateObject(node.id, { name, props: { due: due ? fromInputs(due, "") : undefined, notes: notes.trim() || undefined } }); onClose(); }}>
        <div><label className="ru-label" htmlFor="tk-name">Intitulé</label><input id="tk-name" className="ru-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required /></div>
        <div><label className="ru-label" htmlFor="tk-due">Échéance</label><input id="tk-due" type="date" className="ru-field" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div><label className="ru-label" htmlFor="tk-notes">Notes</label><textarea id="tk-notes" className="ru-field" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} /></div>
        {source ? <button type="button" className="ru-chip" onClick={() => { onClose(); go(openTarget(source)); }}><ExternalLink className="h-4 w-4" aria-hidden /> Source : {source.name}</button> : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" className="ru-icon-btn" aria-label="Mettre à la corbeille" title="Mettre à la corbeille" onClick={async () => { if (node) await vault.trash(node.id); onClose(); }}><Trash2 className="h-5 w-5" aria-hidden /></button>
          <div className="flex gap-2"><button type="button" className="ru-chip" onClick={onClose}>Annuler</button><button type="submit" className="ru-chip" data-strong="true">Enregistrer</button></div>
        </div>
      </form>
    </Dialog>
  );
}

function TaskRow({ task, onOpen }: { task: RucheNode; onOpen: () => void }) {
  const { vault } = useVault();
  const done = !!task.props?.done;
  const due = typeof task.props?.due === "number" ? task.props.due : null;
  const late = !done && due !== null && due < startOfDay(Date.now());
  return (
    <motion.li layout className="ru-row">
      <button type="button" role="checkbox" aria-checked={done} aria-label={done ? `Rouvrir « ${task.name} »` : `Terminer « ${task.name} »`} className="ru-icon-btn shrink-0" onClick={() => void vault?.updateObject(task.id, { props: { done: !done } })}>
        {done ? <CircleCheck className="h-6 w-6 text-[var(--ru-ok)]" aria-hidden /> : <Circle className="h-6 w-6" aria-hidden />}
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <span className={`block truncate text-[15px] ${done ? "text-[var(--ru-muted)] line-through" : "font-medium"}`}>{task.name}</span>
        {due !== null ? <span className={`block text-[12.5px] ${late ? "font-semibold text-[var(--ru-danger)]" : "text-[var(--ru-muted)]"}`}>{late ? "En retard · " : ""}{formatWhen(due, true)}</span> : null}
      </button>
    </motion.li>
  );
}

export function Taches({ search, go }: { search: RucheSearch; go: RucheNav }) {
  const { vault } = useVault();
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  if (!vault) return null;
  const all = vault.objects("task");
  const due = detectDates(text)[0];
  const today = startOfDay(Date.now());
  const open = all.filter((t) => !t.props?.done);
  const groups: [string, RucheNode[]][] = [
    ["En retard", open.filter((t) => typeof t.props?.due === "number" && (t.props.due as number) < today)],
    ["Aujourd’hui", open.filter((t) => typeof t.props?.due === "number" && sameDay(t.props.due as number, today))],
    ["À venir", open.filter((t) => typeof t.props?.due === "number" && (t.props.due as number) >= dayStart(1))],
    ["Sans échéance", open.filter((t) => typeof t.props?.due !== "number")],
  ];
  const doneTasks = all.filter((t) => t.props?.done).sort((a, b) => b.updated - a.updated);
  const add = async () => {
    if (!text.trim()) return;
    // Flow : une date écrite dans l'intitulé devient l'échéance (et sort du titre).
    const name = (due ? text.replace(due.text, "") : text).replace(/\s+/g, " ").trim() || text.trim();
    await vault.createObject("task", name, { done: false, due: due?.start });
    setText("");
  };
  const selected = search.id ? vault.node(search.id) : null;
  return (
    <section>
      <Header title="Tâches" subtitle={`${open.length} à faire · ${doneTasks.length} terminée${doneTasks.length > 1 ? "s" : ""}`} />
      <form className="ru-search mb-1" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <Plus className="h-5 w-5 shrink-0 text-[var(--ru-muted)]" aria-hidden />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une tâche… (ex. « Appeler le traiteur vendredi »)" aria-label="Nouvelle tâche" maxLength={200} />
        {text.trim() ? <button type="submit" className="ru-chip !min-h-9" data-strong="true">Ajouter</button> : null}
      </form>
      <p className="mb-5 min-h-5 px-4 text-[12.5px] text-[var(--ru-muted)]">{due ? `Échéance reconnue : ${formatWhen(due.start, true)}` : ""}</p>
      {open.length === 0 && doneTasks.length === 0 ? <p className="ru-card p-6 text-center text-[14px] text-[var(--ru-muted)]">Aucune tâche. Écris-en une ci-dessus, ou sélectionne des lignes « [ ] … » dans un document.</p> : null}
      {groups.filter(([, items]) => items.length).map(([label, items]) => (
        <div key={label} className="mb-5">
          <h2 className={`mb-1 px-1 text-[13px] font-semibold uppercase tracking-[.06em] ${label === "En retard" ? "text-[var(--ru-danger)]" : "text-[var(--ru-muted)]"}`}>{label} · {items.length}</h2>
          <ul>{items.sort((a, b) => ((a.props?.due as number) ?? Infinity) - ((b.props?.due as number) ?? Infinity) || a.created - b.created).map((t) => <TaskRow key={t.id} task={t} onOpen={() => go({ app: "taches", id: t.id })} />)}</ul>
        </div>
      ))}
      {doneTasks.length ? (
        <div>
          <button type="button" className="ru-chip !min-h-9" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>{showDone ? "Masquer" : "Afficher"} les terminées ({doneTasks.length})</button>
          {showDone ? <ul className="mt-2">{doneTasks.slice(0, 100).map((t) => <TaskRow key={t.id} task={t} onOpen={() => go({ app: "taches", id: t.id })} />)}</ul> : null}
        </div>
      ) : null}
      <TaskDialog node={selected?.kind === "task" ? selected : null} onClose={() => go({ app: "taches" }, true)} go={go} />
    </section>
  );
}

// ——— Espaces ———

export function Espaces({ search, go }: { search: RucheSearch; go: RucheNav }) {
  const { vault } = useVault();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[0]);
  if (!vault) return null;
  const space = search.id ? vault.node(search.id) : null;
  if (space?.kind === "space" && !space.trashed) return <SpaceView space={space} go={go} />;
  const spaces = vault.objects("space").sort((a, b) => b.updated - a.updated);
  const create = async () => {
    if (!name.trim()) return;
    const created = await vault.createObject("space", name, { color });
    setCreating(false);
    setName("");
    toast.ok("Espace créé");
    go({ app: "espaces", id: created.id });
  };
  return (
    <section>
      <Header title="Espaces" subtitle="Un espace réunit tout ce qui concerne une activité. Un même élément peut vivre dans plusieurs espaces sans être copié." action={<button type="button" className="ru-chip" data-strong="true" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden /> Espace</button>} />
      {spaces.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {spaces.map((sp, i) => {
            const members = vault.members(sp.id);
            const tint = safeColor(sp.props?.color, SPACE_COLORS[0]);
            return (
              <motion.button key={sp.id} type="button" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} onClick={() => go({ app: "espaces", id: sp.id })}
                className="ru-card relative overflow-hidden p-5 text-left transition hover:-translate-y-0.5">
                <span aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl" style={{ background: tint, opacity: 0.22 }} />
                <Hexagon className="h-7 w-7" style={{ color: tint }} aria-hidden />
                <span className="mt-3 block text-[18px] font-semibold">{sp.name}</span>
                <span className="mt-1 block text-[13px] text-[var(--ru-muted)]">{members.length ? summarize(members) : "Vide pour l’instant"}</span>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <p className="ru-card p-6 text-center text-[14px] text-[var(--ru-muted)]">Crée un espace par projet, association, événement ou matière : documents, grilles, fichiers, tâches et rendez-vous s’y retrouvent.</p>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nouvel espace">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <div><label className="ru-label" htmlFor="sp-name">Nom</label><input id="sp-name" className="ru-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus placeholder="Mariage 2027, Asso du quartier…" /></div>
          <div>
            <span className="ru-label">Couleur</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Couleur">
              {SPACE_COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className="h-9 w-9 rounded-full transition" style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--ru-bg), 0 0 0 5px ${c}` : undefined }} />)}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1"><button type="button" className="ru-chip" onClick={() => setCreating(false)}>Annuler</button><button type="submit" className="ru-chip" data-strong="true" disabled={!name.trim()}>Créer</button></div>
        </form>
      </Dialog>
    </section>
  );
}

function summarize(nodes: RucheNode[]) {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(KIND_LABEL[n.kind], (counts.get(KIND_LABEL[n.kind]) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${n} ${k}${n > 1 && !k.endsWith("s") ? "s" : ""}`).join(" · ");
}

const GROUPS: { kind: RucheNode["kind"]; label: string }[] = [
  { kind: "event", label: "Rendez-vous" },
  { kind: "task", label: "Tâches" },
  { kind: "doc", label: "Documents" },
  { kind: "sheet", label: "Grilles" },
  { kind: "file", label: "Fichiers" },
  { kind: "folder", label: "Dossiers" },
];

function SpaceView({ space, go }: { space: RucheNode; go: RucheNav }) {
  const { vault, tick } = useVault();
  const mods = useModules();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [event, setEvent] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState("");
  const [tasking, setTasking] = useState(false);
  const tint = safeColor(space.props?.color, SPACE_COLORS[0]);
  const candidates = useMemo(() => {
    if (!vault || !adding) return [];
    const q = fold(filter.trim());
    return vault.all().filter((n) => n.id !== space.id && n.kind !== "space" && !vault.isTrashed(n) && !n.spaces?.includes(space.id) && mods.reachable(n) && (!q || fold(n.name).includes(q))).sort((a, b) => b.updated - a.updated).slice(0, 60);
  }, [vault, adding, filter, space.id, tick, mods]);
  if (!vault) return null;
  // Les éléments d'un module désactivé restent rattachés, mais ne sont ni montrés ni créés ici.
  const members = vault.members(space.id).filter(mods.reachable);
  const now = startOfDay(Date.now());

  const link = async (created: Promise<RucheNode>) => { const n = await created; await vault.toggleSpace(n.id, space.id, true); return n; };

  return (
    <section>
      <div className="ru-card relative mb-6 overflow-hidden p-5 sm:p-7">
        <span aria-hidden className="absolute -right-10 -top-16 h-56 w-56 rounded-full blur-3xl" style={{ background: tint, opacity: 0.2 }} />
        <button type="button" className="ru-chip !min-h-9 relative mb-3" onClick={() => go({ app: "espaces" })}><ChevronLeft className="h-4 w-4" aria-hidden /> Espaces</button>
        <div className="relative flex items-center gap-3">
          <Hexagon className="h-9 w-9 shrink-0" style={{ color: tint }} aria-hidden />
          <h1 className="min-w-0 flex-1 truncate text-[clamp(1.6rem,5vw,2.3rem)] font-semibold tracking-[-.02em]">{space.name}</h1>
          <button type="button" className="ru-icon-btn" aria-label="Supprimer l’espace" title="Supprimer l’espace" onClick={() => setConfirm(true)}><Trash2 className="h-5 w-5" aria-hidden /></button>
        </div>
        <p className="relative mt-1 text-[14px] text-[var(--ru-muted)]">{members.length ? summarize(members) : "Ajoute des éléments existants ou crée-les directement ici."}</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <button type="button" className="ru-chip" data-strong="true" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Ajouter un élément existant</button>
          {mods.on("plume") ? <button type="button" className="ru-chip" onClick={() => void link(vault.createContent(null, "doc", `${space.name} — document`, "")).then((n) => go({ app: "plume", id: n.id }))}><FilePlus2 className="h-4 w-4" aria-hidden /> Document</button> : null}
          {mods.on("grille") ? <button type="button" className="ru-chip" onClick={() => void link(vault.createContent(null, "sheet", `${space.name} — grille`, JSON.stringify(emptySheet()))).then((n) => go({ app: "grille", id: n.id }))}><Sheet className="h-4 w-4" aria-hidden /> Grille</button> : null}
          {mods.on("agenda") ? <button type="button" className="ru-chip" onClick={() => setEvent(true)}><CalendarDays className="h-4 w-4" aria-hidden /> Rendez-vous</button> : null}
          {mods.on("taches") ? <button type="button" className="ru-chip" onClick={() => setTasking(true)}><CircleCheck className="h-4 w-4" aria-hidden /> Tâche</button> : null}
        </div>
      </div>
      {GROUPS.map(({ kind, label }) => {
        let items = members.filter((n) => n.kind === kind);
        if (!items.length) return null;
        if (kind === "event") items = items.sort((a, b) => (a.props!.start as number) - (b.props!.start as number));
        return (
          <div key={kind} className="mb-6">
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-[.06em] text-[var(--ru-muted)]">{label} · {items.length}</h2>
            <ul>
              {kind === "task" ? items.map((t) => <TaskRow key={t.id} task={t} onOpen={() => go({ app: "taches", id: t.id })} />) : items.map((n) => (
                <li key={n.id} className="ru-row">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go(openTarget(n))}>
                    <NodeBadge node={n} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{n.name}</span>
                      <span className="block truncate text-[12.5px] text-[var(--ru-muted)]">
                        {n.kind === "event" ? <>{formatWhen(n.props!.start as number, n.props!.allDay as boolean)}{(n.props!.start as number) < now ? " · passé" : ""}{n.props?.place ? <> · <MapPin className="inline h-3 w-3" aria-hidden /> {n.props.place}</> : null}</> : KIND_LABEL[n.kind]}
                      </span>
                    </span>
                  </button>
                  <button type="button" className="ru-chip !min-h-8 !px-3 !text-[12.5px]" onClick={() => void vault.toggleSpace(n.id, space.id, false)} aria-label={`Retirer « ${n.name} » de l’espace`}>Retirer</button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <Dialog open={adding} onClose={() => setAdding(false)} title={`Ajouter à « ${space.name} »`} description="L’élément reste où il est : l’espace n’en garde qu’une référence.">
        <div className="ru-search mb-3"><Search className="h-5 w-5 text-[var(--ru-muted)]" aria-hidden /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer" aria-label="Filtrer" autoFocus /></div>
        <ul className="max-h-[50vh] overflow-y-auto">
          {candidates.map((n) => (
            <li key={n.id}>
              <button type="button" className="ru-row w-full text-left" onClick={() => { void vault.toggleSpace(n.id, space.id, true); toast.ok(`« ${n.name} » ajouté`); }}>
                <NodeBadge node={n} size={32} /><span className="min-w-0 flex-1 truncate">{n.name}</span><span className="text-[12px] text-[var(--ru-muted)]">{KIND_LABEL[n.kind]}</span>
              </button>
            </li>
          ))}
          {!candidates.length ? <li className="p-3 text-[14px] text-[var(--ru-muted)]">Rien à ajouter.</li> : null}
        </ul>
      </Dialog>
      <EventDialog open={event} onClose={() => setEvent(false)} go={go} spaces={[space.id]} />
      <NameDialog open={tasking} title="Nouvelle tâche" initial="" confirm="Ajouter" onClose={() => setTasking(false)}
        onSubmit={(t) => { const d = detectDates(t)[0]; void vault.createObject("task", (d ? t.replace(d.text, "") : t).trim() || t, { done: false, due: d?.start }, [space.id]); setTasking(false); }} />
      <Confirm open={confirm} title={`Supprimer l’espace « ${space.name} » ?`} text="L’espace part à la corbeille. Les éléments qu’il réunissait ne sont ni supprimés ni déplacés." confirm="Mettre à la corbeille"
        onCancel={() => setConfirm(false)} onConfirm={async () => { await vault.trash(space.id); setConfirm(false); go({ app: "espaces" }); }} />
    </section>
  );
}
