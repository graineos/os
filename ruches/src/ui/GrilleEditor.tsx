import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ChartBar, Columns3, Download, Hexagon, History, Rows3, Sigma } from "lucide-react";
import { cellId, colName, evaluateSheet, formatValue, FUNCTION_NAMES, isError, parseSheet, sheetText, sheetToCsv, type CellValue, type SheetData } from "../core/sheet";
import { HistoryDialog, SpacesDialog } from "./dialogs";
import { Dialog, Popover } from "./kit";
import { ago, escapeHtml, saveBlob, useVault, type RucheNav } from "./shared";

type Pos = { col: number; row: number };
const SAVE_DELAY = 800;
// Affichage fenêtré : dimensions fixes des cellules (voir .ru-grid dans ruches.css).
const ROW_H = 33;
const COL_W = 112;
const HEAD_W = 46;
const HEAD_H = 28;
const OVERSCAN = 6;

export function GrilleEditor({ id, go }: { id: string; go: RucheNav }) {
  const { vault } = useVault();
  const node = vault?.node(id);
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [title, setTitle] = useState(node?.name ?? "");
  const [sel, setSel] = useState<Pos>({ col: 0, row: 0 });
  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<"saved" | "pending">("saved");
  const [history, setHistory] = useState(false);
  const [spacing, setSpacing] = useState(false);
  const [chart, setChart] = useState(false);
  const [view, setView] = useState({ top: 0, left: 0, height: 640, width: 420 });
  const grid = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<SheetData | null>(null);
  // Cellule en cours de saisie : enregistrée même si l'appli passe en arrière-plan avant validation.
  const pendingEdit = useRef<{ key: string; value: string } | null>(null);

  const load = useCallback(async () => {
    if (!vault) return;
    const data = parseSheet(await vault.readText(id));
    latest.current = data;
    setSheet(data);
  }, [vault, id]);

  useEffect(() => {
    if (node) setTitle(node.name);
    void load();
  }, [id, vault]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (!vault || !latest.current) return;
    let snapshot = latest.current;
    const pending = pendingEdit.current;
    if (pending) {
      const cells = { ...snapshot.cells };
      if (pending.value === "") delete cells[pending.key];
      else cells[pending.key] = pending.value;
      snapshot = { ...snapshot, cells };
    }
    await vault.saveContent(id, JSON.stringify(snapshot), sheetText(snapshot));
    setStatus("saved");
  }, [vault, id]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && timer.current) void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) void flush();
    };
  }, [flush]);

  const values = useMemo(() => (sheet ? evaluateSheet(sheet) : {}), [sheet]);

  // Seules les cellules visibles (plus une marge) sont créées : une feuille de 5 000 × 702 reste fluide.
  const loaded = sheet !== null;
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const sync = () => setView({ top: el.scrollTop, left: el.scrollLeft, height: el.clientHeight, width: el.clientWidth });
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [loaded]);

  if (!vault) return null;
  if (!node || node.kind !== "sheet") return <p className="p-8 text-center">Cette grille n’existe plus.</p>;
  if (!sheet) return <p className="p-8 text-center" style={{ color: "var(--ru-muted)" }}>Ouverture de la grille…</p>;

  const mutate = (next: SheetData) => {
    latest.current = next;
    setSheet(next);
    setStatus("pending");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY);
  };

  const setCells = (entries: Record<string, string>) => {
    const cells = { ...sheet.cells };
    for (const [key, value] of Object.entries(entries)) {
      if (value === "") delete cells[key];
      else cells[key] = value;
    }
    mutate({ ...sheet, cells });
  };

  const range = anchor
    ? { c0: Math.min(anchor.col, sel.col), c1: Math.max(anchor.col, sel.col), r0: Math.min(anchor.row, sel.row), r1: Math.max(anchor.row, sel.row) }
    : { c0: sel.col, c1: sel.col, r0: sel.row, r1: sel.row };
  const inRange = (c: number, r: number) => c >= range.c0 && c <= range.c1 && r >= range.r0 && r <= range.r1;
  const selectedNums: number[] = [];
  for (let r = range.r0; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) { const v = values[cellId(c, r)]; if (typeof v === "number") selectedNums.push(v); }

  const current = cellId(sel.col, sel.row);
  const edit = (value: string) => {
    setEditing(value);
    pendingEdit.current = { key: current, value };
    setStatus("pending");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY);
  };
  const cancel = () => {
    pendingEdit.current = null;
    setEditing(null);
    grid.current?.focus();
  };
  const commit = (move?: Pos) => {
    if (editing !== null) setCells({ [current]: editing });
    pendingEdit.current = null;
    setEditing(null);
    if (move) select(move);
    grid.current?.focus();
  };
  const select = (pos: Pos, extend = false) => {
    const next = { col: Math.max(0, Math.min(sheet.cols - 1, pos.col)), row: Math.max(0, Math.min(sheet.rows - 1, pos.row)) };
    setAnchor(extend ? anchor ?? sel : null);
    setSel(next);
    // Défilement calculé (la cellule visée peut ne pas être encore rendue).
    const el = grid.current;
    if (el) {
      const top = next.row * ROW_H;
      const left = next.col * COL_W;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (top + ROW_H > el.scrollTop + el.clientHeight - HEAD_H) el.scrollTop = top + ROW_H - el.clientHeight + HEAD_H;
      if (left < el.scrollLeft) el.scrollLeft = left;
      else if (left + COL_W > el.scrollLeft + el.clientWidth - HEAD_W) el.scrollLeft = left + COL_W - el.clientWidth + HEAD_W;
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (editing !== null) return;
    const moves: Record<string, Pos> = { ArrowUp: { col: sel.col, row: sel.row - 1 }, ArrowDown: { col: sel.col, row: sel.row + 1 }, ArrowLeft: { col: sel.col - 1, row: sel.row }, ArrowRight: { col: sel.col + 1, row: sel.row } };
    if (moves[e.key]) { e.preventDefault(); select(moves[e.key], e.shiftKey); return; }
    if (e.key === "Tab") { e.preventDefault(); select({ col: sel.col + (e.shiftKey ? -1 : 1), row: sel.row }); return; }
    if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); setEditing(sheet.cells[current] ?? ""); return; }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const cleared: Record<string, string> = {};
      for (let r = range.r0; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) cleared[cellId(c, r)] = "";
      setCells(cleared);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const rows: string[] = [];
      for (let r = range.r0; r <= range.r1; r++) { const row: string[] = []; for (let c = range.c0; c <= range.c1; c++) row.push(formatValue(values[cellId(c, r)])); rows.push(row.join("\t")); }
      void navigator.clipboard?.writeText(rows.join("\n"));
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); edit(e.key); }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing !== null) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const entries: Record<string, string> = {};
    text.replace(/\r/g, "").split("\n").forEach((line, r) => line.split("\t").forEach((value, c) => { if (sel.row + r < sheet.rows && sel.col + c < sheet.cols) entries[cellId(sel.col + c, sel.row + r)] = value; }));
    setCells(entries);
  };

  const saveTitle = async () => {
    if (title.trim() && title.trim() !== node.name) await vault.update(id, { name: title.trim() });
    else setTitle(node.name);
  };

  const sum = selectedNums.reduce((a, b) => a + b, 0);
  const firstRow = Math.max(0, Math.floor(view.top / ROW_H) - OVERSCAN);
  const lastRow = Math.min(sheet.rows - 1, Math.ceil((view.top + view.height) / ROW_H) + OVERSCAN);
  const firstCol = Math.max(0, Math.floor(view.left / COL_W) - OVERSCAN);
  const lastCol = Math.min(sheet.cols - 1, Math.ceil((view.left + view.width) / COL_W) + OVERSCAN);
  const visibleRows = Array.from({ length: Math.max(0, lastRow - firstRow + 1) }, (_, i) => firstRow + i);
  const visibleCols = Array.from({ length: Math.max(0, lastCol - firstCol + 1) }, (_, i) => firstCol + i);

  return (
    <div className="-mx-4 flex flex-col sm:mx-0">
      <div className="mb-2 flex items-center gap-2 px-4 sm:px-0">
        <button type="button" className="ru-icon-btn shrink-0" aria-label="Retour aux fichiers" onClick={() => go({ app: "fichiers", dossier: node.parent ?? undefined })}><ArrowLeft className="h-5 w-5" aria-hidden /></button>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} aria-label="Titre de la grille" maxLength={200}
          className="h-10 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-[18px] font-medium outline-none focus:bg-[var(--ru-surface-2)]" />
        <span className="hidden shrink-0 text-[12.5px] sm:inline" style={{ color: "var(--ru-muted)" }} role="status">{status === "saved" ? `Enregistré ${ago(node.updated)}` : "Enregistrement…"}</span>
        <button type="button" className="ru-icon-btn shrink-0" title="Espaces" aria-label="Espaces de la grille" onClick={() => setSpacing(true)}><Hexagon className="h-5 w-5" aria-hidden /></button>
        <button type="button" className="ru-icon-btn shrink-0" title="Historique" aria-label="Historique des versions" onClick={() => setHistory(true)}><History className="h-5 w-5" aria-hidden /></button>
        <button type="button" className="ru-icon-btn shrink-0" title="Exporter en CSV" aria-label="Exporter en CSV" onClick={() => saveBlob(new Blob(["﻿", sheetToCsv(sheet)], { type: "text/csv" }), `${node.name}.csv`)}><Download className="h-5 w-5" aria-hidden /></button>
      </div>

      <div className="mb-2 flex items-center gap-2 px-4 sm:px-0">
        <span className="grid h-10 min-w-[56px] place-items-center rounded-xl px-2 text-[13px] font-semibold tabular-nums" style={{ background: "var(--ru-surface-2)" }}>{current}</span>
        <input
          value={editing ?? sheet.cells[current] ?? ""}
          onFocus={() => editing === null && setEditing(sheet.cells[current] ?? "")}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit({ col: sel.col, row: sel.row + 1 }); } if (e.key === "Escape") cancel(); }}
          onBlur={() => editing !== null && commit()}
          placeholder="Valeur ou formule, ex. =SOMME(A1:A5)"
          aria-label={`Contenu de la cellule ${current}`}
          className="h-10 min-w-0 flex-1 rounded-xl border bg-transparent px-3 font-mono text-[14px] outline-none focus:border-[var(--ru-honey)]"
          style={{ borderColor: "var(--ru-line-strong)" }}
        />
        <Popover label="Fonctions disponibles" trigger={<Sigma className="h-5 w-5" aria-hidden />}>
          <p className="font-medium">Fonctions</p>
          <p className="mt-1 font-mono text-[12px] leading-relaxed">{FUNCTION_NAMES.join(" · ")}</p>
          <p className="mt-2 text-[var(--ru-muted)]">Opérateurs : + − * / ^ % & = &lt;&gt; &lt; &gt;. Séparateur « ; ». Noms anglais acceptés (SUM, IF…).</p>
        </Popover>
      </div>

      <div ref={grid} tabIndex={0} onKeyDown={onKey} onPaste={onPaste} className="relative max-h-[calc(100dvh-260px)] overflow-auto border-y outline-none sm:rounded-2xl sm:border" style={{ borderColor: "var(--ru-line)" }} aria-label="Grille de cellules" role="grid">
        <table className="ru-grid" style={{ width: HEAD_W + sheet.cols * COL_W }}>
          <thead>
            <tr>
              <th aria-hidden />
              {firstCol > 0 ? <th aria-hidden className="ru-spacer" style={{ width: firstCol * COL_W }} /> : null}
              {visibleCols.map((c) => <th key={c} data-sel={c >= range.c0 && c <= range.c1} scope="col">{colName(c)}</th>)}
              {lastCol < sheet.cols - 1 ? <th aria-hidden className="ru-spacer" style={{ width: (sheet.cols - 1 - lastCol) * COL_W }} /> : null}
            </tr>
          </thead>
          <tbody>
            {firstRow > 0 ? <tr aria-hidden><td className="ru-spacer" colSpan={visibleCols.length + 3} style={{ height: firstRow * ROW_H }} /></tr> : null}
            {visibleRows.map((r) => (
              <tr key={r}>
                <th data-sel={r >= range.r0 && r <= range.r1} scope="row">{r + 1}</th>
                {firstCol > 0 ? <td aria-hidden className="ru-spacer" /> : null}
                {visibleCols.map((c) => {
                  const key = cellId(c, r);
                  const v = values[key];
                  const isSel = sel.col === c && sel.row === r;
                  return (
                    <td key={c} data-cell={key} data-sel={inRange(c, r)} data-num={typeof v === "number"} data-err={isError(v)}
                      onMouseDown={(e) => { if (editing !== null && !isSel) commit(); select({ col: c, row: r }, e.shiftKey); }}
                      onDoubleClick={() => setEditing(sheet.cells[key] ?? "")}
                      onClick={() => { if (isSel && editing === null && window.matchMedia("(pointer: coarse)").matches) setEditing(sheet.cells[key] ?? ""); }}>
                      {isSel && editing !== null ? (
                        <input autoFocus value={editing} onChange={(e) => edit(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commit({ col: c, row: r + 1 }); }
                            else if (e.key === "Tab") { e.preventDefault(); commit({ col: c + 1, row: r }); }
                            else if (e.key === "Escape") cancel();
                          }}
                          onBlur={() => commit()} aria-label={`Modifier ${key}`} />
                      ) : formatValue(v)}
                    </td>
                  );
                })}
                {lastCol < sheet.cols - 1 ? <td aria-hidden className="ru-spacer" /> : null}
              </tr>
            ))}
            {lastRow < sheet.rows - 1 ? <tr aria-hidden><td className="ru-spacer" colSpan={visibleCols.length + 3} style={{ height: (sheet.rows - 1 - lastRow) * ROW_H }} /></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 px-4 sm:px-0">
        <button type="button" className="ru-chip !min-h-9" onClick={() => mutate({ ...sheet, rows: Math.min(sheet.rows + 20, 5000) })}><Rows3 className="h-4 w-4" aria-hidden /> +20 lignes</button>
        <button type="button" className="ru-chip !min-h-9" onClick={() => mutate({ ...sheet, cols: Math.min(sheet.cols + 1, 702) })}><Columns3 className="h-4 w-4" aria-hidden /> +1 colonne</button>
        {selectedNums.length > 1 ? <button type="button" className="ru-chip !min-h-9" data-strong="true" onClick={() => setChart(true)}><ChartBar className="h-4 w-4" aria-hidden /> Graphique</button> : null}
        {selectedNums.length > 1 ? (
          <span className="ml-auto text-[13px] tabular-nums" style={{ color: "var(--ru-muted)" }} role="status">
            Somme {formatValue(sum)} · Moyenne {formatValue(Math.round((sum / selectedNums.length) * 1e6) / 1e6)} · Nb {selectedNums.length}
          </span>
        ) : null}
      </div>

      <HistoryDialog node={history ? node : null} onClose={() => setHistory(false)} onRestored={() => void load()} />
      <SpacesDialog node={spacing ? node : null} onClose={() => setSpacing(false)} />
      <Dialog open={chart} onClose={() => setChart(false)} wide title={`Graphique · ${colName(range.c0)}${range.r0 + 1}:${colName(range.c1)}${range.r1 + 1}`} description="Tracé à partir des cellules sélectionnées, recalculé à chaque modification de la grille.">
        <BarChart data={chartData(values, range)} name={node.name} />
      </Dialog>
    </div>
  );
}

type Range = { c0: number; c1: number; r0: number; r1: number };

/**
 * Prisme « graphique » : libellés = première colonne si elle contient du texte (ou la colonne à gauche),
 * valeurs = première colonne numérique de la sélection. Les lignes sans nombre sont ignorées.
 */
function chartData(values: Record<string, CellValue>, range: Range) {
  const text = (v: CellValue | undefined) => (v === undefined ? "" : formatValue(v));
  const numericCol = (c: number) => { let n = 0; for (let r = range.r0; r <= range.r1; r++) if (typeof values[cellId(c, r)] === "number") n++; return n; };
  let valueCol = range.c0;
  while (valueCol < range.c1 && numericCol(valueCol) === 0) valueCol++;
  const labelCol = valueCol > range.c0 ? range.c0 : range.c0 > 0 && numericCol(range.c0 - 1) === 0 ? range.c0 - 1 : -1;
  const out: { label: string; value: number }[] = [];
  for (let r = range.r0; r <= range.r1 && out.length < 60; r++) {
    const v = values[cellId(valueCol, r)];
    if (typeof v !== "number") continue;
    out.push({ label: labelCol >= 0 ? text(values[cellId(labelCol, r)]) || `Ligne ${r + 1}` : `Ligne ${r + 1}`, value: v });
  }
  return out;
}

function BarChart({ data, name }: { data: { label: string; value: number }[]; name: string }) {
  if (!data.length) return <p className="text-[14px] text-[var(--ru-muted)]">Aucune valeur numérique dans la sélection.</p>;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const row = 30;
  const labelW = 120;
  const width = 640;
  const height = data.length * row + 8;
  const svg = (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`Graphique en barres, ${data.length} valeurs`} style={{ fontFamily: "var(--ru-font)" }}>
      {data.map((d, i) => {
        const w = (Math.abs(d.value) / max) * (width - labelW - 90);
        return (
          <g key={i} transform={`translate(0 ${i * row + 4})`}>
            <text x={labelW - 8} y={row / 2} dy="0.35em" textAnchor="end" fontSize="12" fill="currentColor" opacity="0.75">{d.label.length > 18 ? `${d.label.slice(0, 17)}…` : d.label}</text>
            <rect x={labelW} y={4} width={Math.max(w, 1)} height={row - 10} rx="6" fill={d.value < 0 ? "#dc2626" : "#f59e0b"} />
            <text x={labelW + w + 6} y={row / 2} dy="0.35em" fontSize="12" fontWeight="600" fill="currentColor">{d.value.toLocaleString("fr-FR")}</text>
          </g>
        );
      })}
    </svg>
  );
  const exportSvg = () => {
    const body = data.map((d, i) => {
      const w = (Math.abs(d.value) / max) * (width - labelW - 90);
      return `<g transform="translate(0 ${i * row + 4})"><text x="${labelW - 8}" y="${row / 2}" dy="0.35em" text-anchor="end" font-size="12">${escapeHtml(d.label)}</text><rect x="${labelW}" y="4" width="${Math.max(w, 1)}" height="${row - 10}" rx="6" fill="${d.value < 0 ? "#dc2626" : "#f59e0b"}"/><text x="${labelW + w + 6}" y="${row / 2}" dy="0.35em" font-size="12" font-weight="600">${d.value}</text></g>`;
    }).join("");
    saveBlob(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" font-family="system-ui,sans-serif">${body}</svg>`], { type: "image/svg+xml" }), `${name} — graphique.svg`);
  };
  return (
    <div>
      <div className="max-h-[60vh] overflow-y-auto rounded-2xl bg-[var(--ru-surface-2)] p-3">{svg}</div>
      <button type="button" className="ru-chip mt-3" onClick={exportSvg}><Download className="h-4 w-4" aria-hidden /> Exporter en SVG</button>
    </div>
  );
}
