import { useEffect, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Download, ExternalLink, FilePlus2, FolderInput, FolderPlus, Hexagon, History, Home, MoreVertical, Pencil, RotateCcw, Sheet, Star, Trash2, Upload, X } from "lucide-react";
import { csvToSheet, parseSheet, sheetText, sheetToCsv } from "../core/sheet";
import { sanitizeHtml } from "../core/sanitize";
import { htmlToText, isTextual, type RucheNode } from "../core/vault";
import { HistoryDialog, MoveDialog, NameDialog, SpacesDialog } from "./dialogs";
import { Confirm, Dialog, Menu, MenuItem, MenuSeparator, useToast } from "./kit";
import { ago, formatBytes, NodeBadge, openTarget, saveBlob, textToDocHtml, useModules, useVault, type RucheNav, type RucheSearch } from "./shared";

const DRAG_TYPE = "application/x-ruche-node";

export function RucheFiles({ go, search }: { go: RucheNav; search: RucheSearch }) {
  const { vault, tick } = useVault();
  const mods = useModules();
  const toast = useToast();
  const folderId = search.dossier ?? null;
  const pick = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ name: string; done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ mode: "folder" } | { mode: "rename"; node: RucheNode } | null>(search.nouveau === "dossier" ? { mode: "folder" } : null);
  const [moving, setMoving] = useState<RucheNode | null>(null);
  const [history, setHistory] = useState<RucheNode | null>(null);
  const [spacing, setSpacing] = useState<RucheNode | null>(null);

  useEffect(() => {
    if (search.nouveau === "dossier") go({ ...search, nouveau: undefined }, true);
    // Lien « nouveau dossier » de l'accueil : consommé une seule fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!vault) return null;
  const folder = folderId ? vault.node(folderId) : null;
  if (folderId && (!folder || folder.kind !== "folder" || vault.isTrashed(folder))) {
    return <EmptyState title="Ce dossier n’existe plus" action={<button type="button" className="ru-chip" onClick={() => go({ app: "fichiers" })}>Revenir à la racine</button>} />;
  }
  void tick;
  const items = vault.children(folderId);
  const crumbs = vault.path(folderId);
  const preview = search.voir ? vault.node(search.voir) ?? null : null;

  const importFiles = async (files: File[], parent = folderId) => {
    if (!files.length) return;
    try {
      for (const file of files) {
        setProgress({ name: file.name, done: 0, total: file.size });
        await vault.importFile(parent, file, (done) => setProgress({ name: file.name, done, total: file.size }));
      }
      toast.ok(files.length > 1 ? `${files.length} fichiers importés` : `« ${files[0].name} » importé`);
    } catch (error) {
      toast.error(error instanceof Error && /quota/i.test(error.message) ? "Plus de place sur cet appareil." : "Import impossible.");
    } finally {
      setProgress(null);
    }
  };

  // Un document ou une grille dont le module est désactivé s'ouvre en aperçu (lecture, téléchargement).
  const open = (node: RucheNode) => go(node.kind === "file" || !mods.reachable(node) ? { ...search, voir: node.id } : openTarget(node));

  const onDrop = async (event: DragEvent, parent: string | null) => {
    event.preventDefault();
    setDragging(false);
    setDropTarget(null);
    const moved = event.dataTransfer.getData(DRAG_TYPE);
    if (moved) {
      if (moved === parent) return;
      try {
        await vault.update(moved, { parent });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Déplacement impossible.");
      }
      return;
    }
    await importFiles(Array.from(event.dataTransfer.files), parent);
  };

  return (
    <div
      className={`min-h-[60vh] rounded-[28px] transition ${dragging ? "ru-drop" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => void onDrop(e, folderId)}
    >
      <nav aria-label="Emplacement" className="mb-3 flex min-w-0 items-center gap-1 overflow-x-auto text-[15px]">
        <button type="button" className={`ru-chip !min-h-9 shrink-0 ${crumbs.length ? "!bg-transparent" : ""}`} onClick={() => go({ app: "fichiers" })}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault(); }} onDrop={(e) => { e.stopPropagation(); void onDrop(e, null); }}>
          <Home className="h-4 w-4" aria-hidden /> Fichiers
        </button>
        {crumbs.map((c, i) => (
          <span key={c.id} className="flex shrink-0 items-center gap-1">
            <ChevronRight className="h-4 w-4 opacity-50" aria-hidden />
            <button type="button" className={`ru-chip !min-h-9 ${i < crumbs.length - 1 ? "!bg-transparent" : ""}`} onClick={() => go({ app: "fichiers", dossier: c.id })}>{c.name}</button>
          </span>
        ))}
      </nav>

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className="ru-chip" data-strong="true" onClick={() => pick.current?.click()} disabled={!!progress}><Upload className="h-4 w-4" aria-hidden /> Importer</button>
        <button type="button" className="ru-chip" onClick={() => setNaming({ mode: "folder" })}><FolderPlus className="h-4 w-4" aria-hidden /> Dossier</button>
        {mods.on("plume") ? <button type="button" className="ru-chip" onClick={async () => go({ app: "plume", id: (await vault.createContent(folderId, "doc", "Document sans titre", "")).id })}><FilePlus2 className="h-4 w-4" aria-hidden /> Document</button> : null}
        <input ref={pick} type="file" multiple hidden onChange={(e) => { void importFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>

      <AnimatePresence>
        {progress ? (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="ru-card mb-3 p-3" role="status">
            <p className="truncate text-[13px]">Découpage en alvéoles : {progress.name}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--ru-surface-3)" }}>
              <div className="h-full rounded-full transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%`, background: "linear-gradient(90deg,var(--ru-honey),var(--ru-honey-deep))" }} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {items.length ? (
        <ul className="space-y-0.5">
          {items.map((node) => (
            <li key={node.id}>
              <div
                className="ru-row"
                data-drop={dropTarget === node.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, node.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { if (node.kind === "folder" && (e.dataTransfer.types.includes(DRAG_TYPE) || e.dataTransfer.types.includes("Files"))) { e.preventDefault(); e.stopPropagation(); setDropTarget(node.id); } }}
                onDragLeave={() => setDropTarget((t) => (t === node.id ? null : t))}
                onDrop={(e) => { if (node.kind === "folder") { e.stopPropagation(); void onDrop(e, node.id); } }}
              >
                <button type="button" onClick={() => open(node)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <NodeBadge node={node} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[15px] font-medium">{node.name}{node.starred ? <Star className="h-3.5 w-3.5 shrink-0 fill-current" style={{ color: "var(--ru-honey)" }} aria-label="Favori" /> : null}</span>
                    <span className="block text-[12.5px]" style={{ color: "var(--ru-muted)" }}>
                      {node.kind === "folder" ? `${vault.children(node.id).length} élément${vault.children(node.id).length > 1 ? "s" : ""}` : `${formatBytes(vault.sizeOf(node))} · ${ago(node.updated)}${node.versions.length > 1 ? ` · ${node.versions.length} versions` : ""}`}
                    </span>
                  </span>
                </button>
                <NodeMenu node={node} onRename={() => setNaming({ mode: "rename", node })} onMove={() => setMoving(node)} onHistory={() => setHistory(node)} onSpaces={() => setSpacing(node)} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={folder ? "Dossier vide" : "Rien ici pour l’instant"} text="Glisse des fichiers ici, ou utilise « Importer »." />
      )}

      <NameDialog open={!!naming} title={naming?.mode === "rename" ? "Renommer" : "Nouveau dossier"} initial={naming?.mode === "rename" ? naming.node.name : "Nouveau dossier"} confirm={naming?.mode === "rename" ? "Renommer" : "Créer"}
        onClose={() => setNaming(null)}
        onSubmit={async (name) => {
          if (naming?.mode === "rename") await vault.update(naming.node.id, { name });
          else await vault.createFolder(folderId, name);
          setNaming(null);
        }} />
      <MoveDialog node={moving} onClose={() => setMoving(null)} />
      <SpacesDialog node={spacing} onClose={() => setSpacing(null)} />
      <HistoryDialog node={history ? vault.node(history.id) ?? null : null} onClose={() => setHistory(null)} />
      <FilePreview node={preview && preview.kind === "file" ? preview : null} onClose={() => go({ ...search, voir: undefined }, true)} go={go} />
    </div>
  );
}

function NodeMenu({ node, onRename, onMove, onHistory, onSpaces }: { node: RucheNode; onRename: () => void; onMove: () => void; onHistory: () => void; onSpaces: () => void }) {
  const { vault } = useVault();
  const toast = useToast();
  if (!vault) return null;
  return (
    <Menu label={`Actions pour ${node.name}`} trigger={<MoreVertical className="h-5 w-5" aria-hidden />}>
      <MenuItem icon={<Pencil />} onSelect={onRename}>Renommer</MenuItem>
      <MenuItem icon={<FolderInput />} onSelect={onMove}>Déplacer</MenuItem>
      <MenuItem icon={<Hexagon />} onSelect={onSpaces}>Espaces{node.spaces?.length ? ` (${node.spaces.length})` : ""}</MenuItem>
      <MenuItem icon={<Star />} onSelect={() => void vault.update(node.id, { starred: !node.starred })}>{node.starred ? "Retirer des favoris" : "Ajouter aux favoris"}</MenuItem>
      {node.kind !== "folder" ? (
        <>
          <MenuItem icon={<Download />} onSelect={async () => saveBlob(await vault.read(node.id), node.kind === "doc" ? `${node.name}.html` : node.kind === "sheet" ? `${node.name}.grille.json` : node.name)}>Télécharger</MenuItem>
          <MenuItem icon={<History />} onSelect={onHistory}>Historique ({node.versions.length})</MenuItem>
        </>
      ) : null}
      <MenuSeparator />
      <MenuItem icon={<Trash2 />} danger onSelect={async () => { await vault.trash(node.id); toast.ok("Mis à la corbeille", { label: "Annuler", run: () => void vault.trash(node.id, true) }); }}>Mettre à la corbeille</MenuItem>
    </Menu>
  );
}

function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="ru-card mx-auto mt-6 max-w-md p-8 text-center">
      <svg viewBox="0 0 64 56" className="mx-auto h-14 w-14" aria-hidden>
        <path d="M16 2h32l16 26-16 26H16L0 28Z" fill="none" stroke="var(--ru-honey)" strokeWidth="2.5" strokeDasharray="6 5" />
      </svg>
      <p className="mt-3 text-[16px] font-medium">{title}</p>
      {text ? <p className="mt-1 text-[14px]" style={{ color: "var(--ru-muted)" }}>{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// Types affichables directement : jamais de HTML/SVG ouvert dans un onglet (exécution de script).
const VIEWABLE = /^(image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)|video\/(mp4|webm|ogg|quicktime)|audio\/|application\/pdf)/i;

function FilePreview({ node, onClose, go }: { node: RucheNode | null; onClose: () => void; go: RucheNav }) {
  const { vault } = useVault();
  const mods = useModules();
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mime = node?.mime ?? "";
  const isCsv = /csv|tab-separated/.test(mime) || /\.(csv|tsv)$/i.test(node?.name ?? "");
  const isText = !!node && isTextual(node.name, mime);

  useEffect(() => {
    if (!node || !vault) return;
    let objectUrl: string | null = null;
    let alive = true;
    setUrl(null);
    setText(null);
    setError(null);
    (async () => {
      try {
        if (VIEWABLE.test(mime)) {
          objectUrl = URL.createObjectURL(await vault.read(node.id, undefined, mime));
          if (alive) setUrl(objectUrl);
        } else if (isText && vault.sizeOf(node) < 2 * 1024 * 1024) {
          const content = await vault.readText(node.id);
          // Document ou grille ouverts en aperçu (module désactivé) : leur texte, pas leur format interne.
          const readable = node.kind === "doc" ? htmlToText(content) : node.kind === "sheet" ? sheetToCsv(parseSheet(content)) : content;
          if (alive) setText(readable.slice(0, 200_000));
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Lecture impossible.");
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [node?.id, node?.versions.length, vault, mime, isText]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vault) return null;

  const convert = async () => {
    if (!node) return;
    const content = await vault.readText(node.id);
    const base = node.name.replace(/\.[^.]+$/, "");
    if (isCsv) {
      const sheet = csvToSheet(content);
      const created = await vault.createContent(node.parent, "sheet", base, JSON.stringify(sheet), sheetText(sheet));
      go({ app: "grille", id: created.id });
    } else {
      const html = /html/.test(mime) || /\.html?$/i.test(node.name) ? sanitizeHtml(content) : textToDocHtml(content);
      const created = await vault.createContent(node.parent, "doc", base, html, htmlToText(html));
      go({ app: "plume", id: created.id });
    }
  };

  return (
    <Dialog open={!!node} onClose={onClose} title={node?.name ?? ""} wide bare>
      <div className="flex max-h-[86dvh] flex-col gap-3">
        <div className="flex items-center gap-3">
          {node ? <NodeBadge node={node} size={36} /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-medium">{node?.name}</p>
            <p className="text-[12px]" style={{ color: "var(--ru-muted)" }}>{node ? `${formatBytes(vault.sizeOf(node))} · ${node.versions[0]?.chunks.length ?? 0} alvéoles · ${ago(node.updated)}` : ""}</p>
          </div>
          {node ? <button type="button" className="ru-icon-btn" aria-label="Télécharger" title="Télécharger" onClick={async () => saveBlob(await vault.read(node.id), node.name)}><Download className="h-5 w-5" aria-hidden /></button> : null}
          {url && !/svg/i.test(mime) ? <a className="ru-icon-btn" href={url} target="_blank" rel="noreferrer" aria-label="Ouvrir en plein écran" title="Ouvrir en plein écran"><ExternalLink className="h-5 w-5" aria-hidden /></a> : null}
          <button type="button" className="ru-icon-btn" aria-label="Fermer" onClick={onClose}><X className="h-5 w-5" aria-hidden /></button>
        </div>
        <div className="min-h-[200px] flex-1 overflow-auto rounded-2xl" style={{ background: "var(--ru-surface-2)" }}>
          {error ? <p className="p-6 text-center text-[14px] text-[var(--ru-danger)]">{error}</p>
            : url && mime.startsWith("image/") ? <img src={url} alt={node?.name ?? ""} className="mx-auto max-h-[70dvh] object-contain" />
            : url && mime.startsWith("video/") ? <video src={url} controls playsInline className="mx-auto max-h-[70dvh] w-full" />
            : url && mime.startsWith("audio/") ? <div className="grid h-full min-h-[200px] place-items-center p-6"><audio src={url} controls className="w-full max-w-md" /></div>
            : url && mime === "application/pdf" ? (
              // <object> est interdit par la politique de sécurité du site (object-src 'none') : cadre + secours explicite.
              <div className="flex h-full flex-col">
                <iframe src={url} title={`Aperçu de ${node?.name ?? "PDF"}`} className="h-[62dvh] w-full rounded-t-2xl bg-white" />
                <p className="p-3 text-center text-[12.5px] text-[var(--ru-muted)]">Aperçu vide (fréquent sur téléphone) ? Utilise « Ouvrir en plein écran » ou « Télécharger » ci-dessus.</p>
              </div>
            )
            : text !== null ? <pre className="whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed">{text}</pre>
            : <p className="p-6 text-center text-[14px]" style={{ color: "var(--ru-muted)" }}>{VIEWABLE.test(mime) || isText ? "Assemblage des alvéoles…" : "Pas d’aperçu pour ce type de fichier. Tu peux le télécharger."}</p>}
        </div>
        {node && node.kind === "file" && isText && mods.on(isCsv ? "grille" : "plume") ? (
          <button type="button" className="ru-chip self-start" onClick={convert}>
            {isCsv ? <><Sheet className="h-4 w-4" aria-hidden /> Ouvrir une copie dans Grille</> : <><FilePlus2 className="h-4 w-4" aria-hidden /> Ouvrir une copie dans Plume</>}
          </button>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Corbeille : restaurer, ou supprimer définitivement après confirmation. */
export function RucheTrash() {
  const { vault } = useVault();
  const toast = useToast();
  const [confirm, setConfirm] = useState<RucheNode[] | null>(null);
  if (!vault) return null;
  const items = vault.trashed();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px]" style={{ color: "var(--ru-muted)" }}>Les éléments restent ici tant que tu ne les supprimes pas définitivement.</p>
        {items.length ? <button type="button" className="ru-chip" onClick={() => setConfirm(items)}><Trash2 className="h-4 w-4" aria-hidden /> Vider la corbeille</button> : null}
      </div>
      {items.length ? (
        <ul className="space-y-0.5">
          {items.map((node) => (
            <li key={node.id} className="ru-row">
              <NodeBadge node={node} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{node.name}</span>
                <span className="block text-[12.5px]" style={{ color: "var(--ru-muted)" }}>Jeté {ago(node.trashed ?? 0)}</span>
              </span>
              <button type="button" className="ru-icon-btn" title="Restaurer" aria-label={`Restaurer ${node.name}`} onClick={() => void vault.trash(node.id, true)}><RotateCcw className="h-5 w-5" aria-hidden /></button>
              <button type="button" className="ru-icon-btn" title="Supprimer définitivement" aria-label={`Supprimer définitivement ${node.name}`} onClick={() => setConfirm([node])}><X className="h-5 w-5" aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Corbeille vide" />
      )}
      <Confirm
        open={!!confirm}
        title="Supprimer définitivement ?"
        text={`${confirm?.length === 1 ? `« ${confirm[0].name} »` : `${confirm?.length} éléments`} et tout leur historique seront effacés de cet appareil. Les alvéoles encore utilisées ailleurs sont conservées. Action irréversible.`}
        confirm="Supprimer"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm) await vault.purge(confirm.map((n) => n.id)); setConfirm(null); toast.ok("Supprimé définitivement"); }}
      />
    </div>
  );
}
