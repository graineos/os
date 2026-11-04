import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bold, CalendarPlus, CircleCheck, Code, Download, Euro, Heading1, Heading2, Heading3, Hexagon, History, Italic, Link2, List, ListOrdered, Minus, Pilcrow, Printer, Quote, Redo2, RemoveFormatting, Sheet, Strikethrough, Underline, Undo2 } from "lucide-react";
import { detectAmounts, detectDates, detectTasks, linesToRows } from "../core/detect";
import { sanitizeHtml } from "../core/sanitize";
import { cellId, emptySheet, sheetText } from "../core/sheet";
import { htmlToText } from "../core/vault";
import { HistoryDialog, SpacesDialog } from "./dialogs";
import { Dialog, Menu, MenuItem, useToast } from "./kit";
import { ago, escapeHtml, formatWhen, saveBlob, useModules, useVault, type RucheNav } from "./shared";

const SAVE_DELAY = 900;

export function PlumeEditor({ id, go }: { id: string; go: RucheNav }) {
  const { vault } = useVault();
  const mods = useModules();
  const toast = useToast();
  const node = vault?.node(id);
  const page = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Dernier contenu saisi : encore disponible quand l'éditeur se démonte (la référence au DOM, elle, est déjà détachée).
  const latestHtml = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState(node?.name ?? "");
  const [status, setStatus] = useState<"saved" | "pending" | "saving">("saved");
  const [count, setCount] = useState({ words: 0, chars: 0 });
  const [history, setHistory] = useState(false);
  const [preview, setPreview] = useState<{ html: string; at: number } | null>(null);
  const [selection, setSelection] = useState("");
  const [spacing, setSpacing] = useState(false);

  // Flow : on suit le texte sélectionné dans la page pour proposer les actions qui s'y appliquent.
  useEffect(() => {
    const onSelect = () => {
      const sel = document.getSelection();
      const inside = sel && sel.rangeCount && page.current?.contains(sel.anchorNode) ? sel.toString() : "";
      setSelection(inside.trim().length > 1 ? inside.slice(0, 5000) : "");
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, []);

  const measure = () => {
    const text = page.current?.innerText ?? "";
    setCount({ words: text.trim() ? text.trim().split(/\s+/).length : 0, chars: text.length });
  };

  const load = useCallback(async () => {
    if (!vault || !page.current) return;
    page.current.innerHTML = sanitizeHtml(await vault.readText(id));
    setLoaded(true);
    measure();
  }, [vault, id]);

  useEffect(() => {
    if (node) setTitle(node.name);
    void load();
  }, [id, vault]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const html = page.current?.innerHTML ?? latestHtml.current;
    if (!vault || html === null || !loaded) return;
    setStatus("saving");
    await vault.saveContent(id, html, htmlToText(html));
    setStatus("saved");
  }, [vault, id, loaded]);

  const schedule = () => {
    setStatus("pending");
    latestHtml.current = page.current?.innerHTML ?? latestHtml.current;
    measure();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY);
  };

  // Rien ne se perd : enregistrement immédiat quand on quitte l'onglet ou l'éditeur.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && timer.current) void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) void flush();
    };
  }, [flush]);

  if (!vault) return null;
  if (!node || node.kind !== "doc") return <p className="p-8 text-center">Ce document n’existe plus.</p>;

  // ——— Actions Flow (déterministes : uniquement ce qui a été reconnu dans la sélection) ———
  const dates = selection ? detectDates(selection).slice(0, 2) : [];
  const checkboxes = selection ? detectTasks(selection) : [];
  const lines = selection.split(/\n/).filter((l) => l.trim());
  const amounts = selection ? detectAmounts(selection) : [];
  // Titre tiré de la phrase, sans la date ni les mots de liaison qui la précédaient (« … le », « … à »).
  const label = (text: string, remove?: string) => {
    let out = (remove ? text.replace(remove, "") : text).replace(/\s+/g, " ").trim();
    for (let i = 0; i < 3; i++) out = out.replace(/(?:[\s,;:–-]+|\s+(?:le|la|les|l'|à|a|au|aux|du|de|des|pour|ce|cette|en|vers|dès|ce|jusqu'au|avant|après))$/i, "").trim();
    return out.replace(/^[\s,;:–-]+/, "").slice(0, 100) || node.name;
  };
  const createEvent = async (start: number, allDay: boolean, dateText: string) => {
    const created = await vault.createObject("event", label(lines.length === 1 ? selection : lines.find((l) => l.includes(dateText)) ?? node.name, dateText), { start, allDay, source: id }, node.spaces ?? []);
    toast.ok(`Événement ajouté : ${formatWhen(start, allDay)}`, { label: "Voir", run: () => go({ app: "agenda", id: created.id }) });
  };
  const createTasks = async () => {
    const all = checkboxes.length ? checkboxes : lines.map((l) => ({ text: l.trim(), done: false }));
    const items = all.slice(0, 50);
    for (const item of items) {
      const due = detectDates(item.text)[0];
      await vault.createObject("task", label(item.text, due?.text), { done: item.done, due: due?.start, source: id }, node.spaces ?? []);
    }
    toast.ok(`${items.length > 1 ? `${items.length} tâches créées` : "Tâche créée"}${all.length > items.length ? ` (limite de 50 atteinte : ${all.length - items.length} ligne${all.length - items.length > 1 ? "s" : ""} ignorée${all.length - items.length > 1 ? "s" : ""})` : ""}`, { label: "Voir", run: () => go({ app: "taches" }) });
  };
  const createGrid = async () => {
    const sheet = emptySheet();
    const rows = linesToRows(selection).slice(0, 500);
    rows.forEach((row, r) => row.slice(0, 50).forEach((value, c) => { if (value) sheet.cells[cellId(c, r)] = value; }));
    // Les dimensions couvrent tout le tableau collé (sinon, au-delà de 60 × 12, il serait tronqué).
    sheet.rows = Math.max(sheet.rows, rows.length);
    sheet.cols = Math.max(sheet.cols, ...rows.map((row) => Math.min(row.length, 50)));
    const created = await vault.createContent(node.parent, "sheet", `${node.name} — tableau`, JSON.stringify(sheet), sheetText(sheet));
    if (node.spaces?.length) for (const sp of node.spaces) await vault.toggleSpace(created.id, sp, true);
    go({ app: "grille", id: created.id });
  };
  const total = amounts.length > 1 ? amounts.reduce((sum, a) => sum + a.value, 0) : null;

  const exec = (command: string, value?: string) => {
    page.current?.focus();
    document.execCommand(command, false, value);
    schedule();
  };
  const link = () => {
    const url = window.prompt("Adresse du lien (https://…)");
    if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) exec("createLink", url.trim());
    else if (url) toast.error("Seuls les liens https://, http:// et mailto: sont acceptés.");
  };
  const saveTitle = async () => {
    if (title.trim() && title.trim() !== node.name) await vault.update(id, { name: title.trim() });
    else setTitle(node.name);
  };
  const exportHtml = () => {
    const html = page.current?.innerHTML ?? "";
    saveBlob(new Blob([`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(node.name)}</title><style>body{max-width:760px;margin:40px auto;padding:0 20px;font:16px/1.7 system-ui,sans-serif;color:#1f1f1f}blockquote{border-left:4px solid #f59e0b;margin:0;padding-left:1em;color:#555}</style></head><body>${html}</body></html>`], { type: "text/html" }), `${node.name}.html`);
  };

  // L'impression ne garde que la page Plume, et seulement pendant cette impression.
  const printDoc = () => {
    document.body.classList.add("ru-printing");
    window.addEventListener("afterprint", () => document.body.classList.remove("ru-printing"), { once: true });
    window.print();
  };

  const tools: { icon: ReactNode; label: string; run: () => void }[] = [
    { icon: <Undo2 className="h-[18px] w-[18px]" />, label: "Annuler", run: () => exec("undo") },
    { icon: <Redo2 className="h-[18px] w-[18px]" />, label: "Rétablir", run: () => exec("redo") },
    { icon: <Pilcrow className="h-[18px] w-[18px]" />, label: "Texte normal", run: () => exec("formatBlock", "P") },
    { icon: <Heading1 className="h-[18px] w-[18px]" />, label: "Titre 1", run: () => exec("formatBlock", "H1") },
    { icon: <Heading2 className="h-[18px] w-[18px]" />, label: "Titre 2", run: () => exec("formatBlock", "H2") },
    { icon: <Heading3 className="h-[18px] w-[18px]" />, label: "Titre 3", run: () => exec("formatBlock", "H3") },
    { icon: <Bold className="h-[18px] w-[18px]" />, label: "Gras (Ctrl+B)", run: () => exec("bold") },
    { icon: <Italic className="h-[18px] w-[18px]" />, label: "Italique (Ctrl+I)", run: () => exec("italic") },
    { icon: <Underline className="h-[18px] w-[18px]" />, label: "Souligné (Ctrl+U)", run: () => exec("underline") },
    { icon: <Strikethrough className="h-[18px] w-[18px]" />, label: "Barré", run: () => exec("strikeThrough") },
    { icon: <List className="h-[18px] w-[18px]" />, label: "Liste à puces", run: () => exec("insertUnorderedList") },
    { icon: <ListOrdered className="h-[18px] w-[18px]" />, label: "Liste numérotée", run: () => exec("insertOrderedList") },
    { icon: <Quote className="h-[18px] w-[18px]" />, label: "Citation", run: () => exec("formatBlock", "BLOCKQUOTE") },
    { icon: <Code className="h-[18px] w-[18px]" />, label: "Bloc de code", run: () => exec("formatBlock", "PRE") },
    { icon: <Minus className="h-[18px] w-[18px]" />, label: "Séparateur", run: () => exec("insertHorizontalRule") },
    { icon: <Link2 className="h-[18px] w-[18px]" />, label: "Lien", run: link },
    { icon: <RemoveFormatting className="h-[18px] w-[18px]" />, label: "Effacer la mise en forme", run: () => exec("removeFormat") },
  ];

  return (
    <div className="-mx-4 sm:mx-0">
      <div className="sticky top-[64px] z-30 mb-4 space-y-2 px-4 pb-2 pt-1 backdrop-blur-md sm:px-0" style={{ background: "color-mix(in srgb, var(--ru-bg) 88%, transparent)" }}>
        <div className="flex items-center gap-2">
          <button type="button" className="ru-icon-btn shrink-0" aria-label="Retour aux fichiers" onClick={() => go({ app: "fichiers", dossier: node.parent ?? undefined })}><ArrowLeft className="h-5 w-5" aria-hidden /></button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} aria-label="Titre du document" maxLength={200}
            className="h-10 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-[18px] font-medium outline-none focus:bg-[var(--ru-surface-2)]" />
          <span className="hidden shrink-0 text-[12.5px] sm:inline" style={{ color: "var(--ru-muted)" }} role="status">
            {status === "saved" ? `Enregistré ${ago(node.updated)}` : "Enregistrement…"}
          </span>
          <button type="button" className="ru-icon-btn shrink-0" aria-label="Espaces du document" title="Espaces" onClick={() => setSpacing(true)}><Hexagon className="h-5 w-5" aria-hidden /></button>
          <button type="button" className="ru-icon-btn shrink-0" aria-label="Historique des versions" title="Historique" onClick={() => setHistory(true)}><History className="h-5 w-5" aria-hidden /></button>
          <Menu label="Exporter" trigger={<Download className="h-5 w-5" aria-hidden />}>
            <MenuItem icon={<Download />} onSelect={exportHtml}>Page web (.html)</MenuItem>
            <MenuItem icon={<Download />} onSelect={() => saveBlob(new Blob([page.current?.innerText ?? ""], { type: "text/plain" }), `${node.name}.txt`)}>Texte brut (.txt)</MenuItem>
            <MenuItem icon={<Printer />} onSelect={printDoc}>Imprimer ou PDF</MenuItem>
          </Menu>
        </div>
        <div className="flex gap-0.5 overflow-x-auto rounded-full p-1" style={{ background: "var(--ru-surface-2)" }} role="toolbar" aria-label="Mise en forme">
          {tools.map((tool) => (
            <button key={tool.label} type="button" className="ru-icon-btn !h-9 !w-9 shrink-0" title={tool.label} aria-label={tool.label} onMouseDown={(e) => e.preventDefault()} onClick={tool.run}>{tool.icon}</button>
          ))}
        </div>
      </div>

      <div
        ref={page}
        className="ru-page"
        contentEditable={loaded}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Contenu du document"
        data-placeholder="Commence à écrire…"
        spellCheck
        lang="fr"
        onInput={schedule}
        onPaste={(e) => {
          // Collage : on garde la mise en forme simple, jamais de script ni de style externe.
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          if (html) document.execCommand("insertHTML", false, sanitizeHtml(html));
          else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          schedule();
        }}
      />
      <p className="mt-3 text-center text-[12.5px]" style={{ color: "var(--ru-muted)" }}>
        {count.words} mot{count.words > 1 ? "s" : ""} · {count.chars} caractère{count.chars > 1 ? "s" : ""} · {node.versions.length} version{node.versions.length > 1 ? "s" : ""}
      </p>

      <AnimatePresence>
        {selection && ((mods.on("agenda") && dates.length) || (lines.length && (mods.on("taches") || mods.on("grille"))) || total !== null) ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="ru-flow-dock" role="toolbar" aria-label="Actions sur la sélection">
            <div className="ru-flow" onMouseDown={(e) => e.preventDefault()}>
              {mods.on("agenda") && dates.map((d) => (
                <button key={d.text} type="button" onClick={() => void createEvent(d.start, d.allDay, d.text)}><CalendarPlus className="h-4 w-4" aria-hidden /> Événement · {formatWhen(d.start, d.allDay)}</button>
              ))}
              {mods.on("taches") ? <button type="button" onClick={() => void createTasks()}><CircleCheck className="h-4 w-4" aria-hidden /> {checkboxes.length > 1 || (!checkboxes.length && lines.length > 1) ? `${checkboxes.length || lines.length} tâches` : "Tâche"}</button> : null}
              {lines.length > 1 && mods.on("grille") ? <button type="button" onClick={() => void createGrid()}><Sheet className="h-4 w-4" aria-hidden /> En grille</button> : null}
              {total !== null ? <span className="inline-flex min-h-9 items-center gap-1 px-2 text-[13px] font-semibold"><Euro className="h-4 w-4" aria-hidden /> Total {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SpacesDialog node={spacing ? node : null} onClose={() => setSpacing(false)} />
      <HistoryDialog
        node={history ? node : null}
        onClose={() => setHistory(false)}
        onPreview={async (i) => setPreview({ html: sanitizeHtml(await vault.readText(id, i)), at: node.versions[i].at })}
        onRestored={() => void load()}
      />
      <Dialog open={!!preview} onClose={() => setPreview(null)} wide title={`Version du ${preview ? new Date(preview.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : ""}`}>
        <div className="ru-page !min-h-0 !p-6 !shadow-none" dangerouslySetInnerHTML={{ __html: preview?.html ?? "" }} />
      </Dialog>
    </div>
  );
}
