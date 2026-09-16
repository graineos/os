import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Cpu,
  Download,
  File,
  FilePlus2,
  FileText,
  Folder,
  Gauge,
  Grid2X2,
  Image as ImageIcon,
  Monitor,
  Palette,
  Plus,
  Power,
  Save,
  Search,
  Settings,
  Terminal,
  Trash2,
  Upload,
  Wifi,
} from "lucide-react";
import { kernel } from "./kernel/kernel";
import {
  createTask,
  createTextDocument,
  deleteFile,
  deleteTask,
  downloadOSFile,
  fileAsBlob,
  getFile,
  getSettings,
  importBrowserFile,
  listFiles,
  listTasks,
  saveFile,
  saveSettings,
  saveTask,
  type OSFile,
  type SystemFolder,
  type TaskStatus,
  type WorkTask,
} from "./system/storage";

export type Panel = "files" | "text" | "photos" | "work" | "terminal" | "monitor" | "settings" | "about";
type WindowState = "normal" | "minimized" | "maximized";
type LogLine = { kind: "system" | "user" | "ok" | "error"; text: string };

type AppDefinition = { id: Panel; label: string; icon: React.ReactNode; desktop?: boolean };

const apps: AppDefinition[] = [
  { id: "files", label: "Fichiers", icon: <Folder size={19} />, desktop: true },
  { id: "text", label: "Textes", icon: <FileText size={19} />, desktop: true },
  { id: "photos", label: "Images", icon: <ImageIcon size={19} />, desktop: true },
  { id: "work", label: "Travail", icon: <BriefcaseBusiness size={19} />, desktop: true },
  { id: "terminal", label: "Terminal", icon: <Terminal size={19} /> },
  { id: "monitor", label: "Moniteur", icon: <Gauge size={19} /> },
  { id: "settings", label: "Réglages", icon: <Settings size={19} />, desktop: true },
  { id: "about", label: "À propos", icon: <AppWindow size={19} /> },
];

const folders: SystemFolder[] = ["Bureau", "Documents", "Images", "Travail"];
const wallpaperPresets: Record<string, string> = {
  aurora: "radial-gradient(circle at 16% 18%, #ff6b6b55 0 18%, transparent 38%), radial-gradient(circle at 82% 22%, #7c5cff66 0 20%, transparent 42%), radial-gradient(circle at 62% 82%, #2d9cff55 0 22%, transparent 44%), linear-gradient(140deg,#17171c 0%,#11141d 42%,#21152f 100%)",
  sonoma: "radial-gradient(circle at 18% 28%, #ff8f7060 0 20%, transparent 43%), radial-gradient(circle at 70% 30%, #ff5fb855 0 21%, transparent 46%), radial-gradient(circle at 75% 78%, #7857ff66 0 27%, transparent 49%), linear-gradient(145deg,#24212a,#181820 55%,#0e1018)",
  ocean: "radial-gradient(circle at 22% 18%, #3dd6d055 0 20%, transparent 42%), radial-gradient(circle at 76% 74%, #007aff66 0 28%, transparent 50%), linear-gradient(145deg,#0b1a24,#10283c 56%,#081019)",
  graphite: "radial-gradient(circle at 70% 20%, #ffffff24 0 16%, transparent 42%), linear-gradient(145deg,#35353a,#19191e 52%,#0d0d10)",
};

function BlobImage({ file, className = "" }: { file: OSFile; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    if (file.kind !== "image") return;
    const url = URL.createObjectURL(fileAsBlob(file));
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) return <div className={`image-placeholder ${className}`}><ImageIcon size={28} /></div>;
  return <img className={className} src={src} alt={file.name} />;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(timestamp);
}

export function DesktopApp() {
  const [panel, setPanel] = useState<Panel>("files");
  const [windowState, setWindowState] = useState<WindowState>("normal");
  const [isVisible, setIsVisible] = useState(true);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [files, setFiles] = useState<OSFile[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [folder, setFolder] = useState<SystemFolder>("Bureau");
  const [search, setSearch] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [wallpaper, setWallpaper] = useState("preset:aurora");
  const [wallpaperCss, setWallpaperCss] = useState(wallpaperPresets.aurora);
  const [clock, setClock] = useState(new Date());
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const [editingFile, setEditingFile] = useState<OSFile | null>(null);
  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskProject, setTaskProject] = useState("Général");

  const [version, setVersion] = useState(0);
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([
    { kind: "system", text: "GraineOS — environnement de travail prêt" },
    { kind: "system", text: "Tape help pour afficher les commandes." },
  ]);

  const kernelState = useMemo(() => kernel.status(), [version]);
  const visibleFiles = useMemo(
    () => files.filter((file) => file.folder === folder && file.name.toLowerCase().includes(search.toLowerCase())),
    [files, folder, search],
  );
  const textFiles = useMemo(() => files.filter((file) => file.kind === "text"), [files]);
  const imageFiles = useMemo(() => files.filter((file) => file.kind === "image"), [files]);
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const taskProgress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  async function refreshFiles() {
    setFiles(await listFiles());
  }

  async function refreshTasks() {
    setTasks(await listTasks());
  }

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([refreshFiles(), refreshTasks()]);
        const settings = await getSettings();
        setWallpaper(settings.wallpaper);
        setStorageReady(true);
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : "Stockage indisponible");
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let revoke: (() => void) | undefined;
    void (async () => {
      if (wallpaper.startsWith("preset:")) {
        const id = wallpaper.slice(7);
        setWallpaperCss(wallpaperPresets[id] ?? wallpaperPresets.aurora);
        return;
      }
      if (wallpaper.startsWith("image:")) {
        const image = await getFile(wallpaper.slice(6));
        if (image?.kind === "image") {
          const url = URL.createObjectURL(fileAsBlob(image));
          setWallpaperCss(`url(${JSON.stringify(url)}) center / cover no-repeat`);
          revoke = () => URL.revokeObjectURL(url);
        }
      }
    })();
    return () => revoke?.();
  }, [wallpaper, files]);

  useEffect(() => {
    if (!editingFile) return;
    if (editingFile.name === docName && (editingFile.content ?? "") === docContent) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      const updated: OSFile = {
        ...editingFile,
        name: docName.trim() || "Sans titre.txt",
        content: docContent,
        blob: undefined,
        mime: "text/plain",
        size: new Blob([docContent]).size,
        updatedAt: Date.now(),
      };
      void saveFile(updated).then(async () => {
        setEditingFile(updated);
        await refreshFiles();
        setSaveState("saved");
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [docContent, docName, editingFile]);

  function openPanel(nextPanel: Panel) {
    setPanel(nextPanel);
    setIsVisible(true);
    setWindowState("normal");
    setLauncherOpen(false);
  }

  function closeWindow() {
    setIsVisible(false);
    setWindowState("normal");
  }

  async function openDocument(file: OSFile) {
    setEditingFile(file);
    setDocName(file.name);
    setDocContent(file.content ?? (file.blob ? await file.blob.text() : ""));
    openPanel("text");
  }

  async function newDocument() {
    const file = await createTextDocument();
    await refreshFiles();
    await openDocument(file);
  }

  async function handleImport(fileList: FileList | null, preferredFolder?: SystemFolder) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) await importBrowserFile(file, preferredFolder);
    await refreshFiles();
  }

  async function removeFile(file: OSFile) {
    if (!window.confirm(`Supprimer « ${file.name} » ?`)) return;
    await deleteFile(file.id);
    if (editingFile?.id === file.id) setEditingFile(null);
    await refreshFiles();
  }

  async function changeWallpaper(value: string) {
    setWallpaper(value);
    await saveSettings({ wallpaper: value });
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    await createTask(taskTitle.trim(), taskProject.trim() || "Général");
    setTaskTitle("");
    await refreshTasks();
  }

  async function advanceTask(task: WorkTask) {
    const next: Record<TaskStatus, TaskStatus> = { todo: "doing", doing: "done", done: "todo" };
    await saveTask({ ...task, status: next[task.status], updatedAt: Date.now() });
    await refreshTasks();
  }

  async function removeTask(task: WorkTask) {
    await deleteTask(task.id);
    await refreshTasks();
  }

  function push(kind: LogLine["kind"], text: string) {
    setLogs((current) => [...current, { kind, text }]);
  }

  function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    push("user", `graine@system % ${cmd}`);
    try {
      if (cmd === "help") {
        push("system", "help · status · files · tasks · open <files|text|photos|work|settings> · new <nom> · cells · caps · demo · clear · reboot");
      } else if (cmd === "status") {
        push("ok", `${files.length} fichiers · ${tasks.length} tâches · ${kernelState.cells.length} cellules · stockage ${storageReady ? "prêt" : "initialisation"}`);
      } else if (cmd === "files") {
        files.slice(0, 30).forEach((file) => push("system", `${file.folder}/${file.name} · ${formatSize(file.size)}`));
      } else if (cmd === "tasks") {
        tasks.forEach((task) => push("system", `[${task.status}] ${task.project} · ${task.title}`));
      } else if (cmd.startsWith("open ")) {
        const target = cmd.slice(5).trim();
        const map: Record<string, Panel> = { files: "files", text: "text", photos: "photos", work: "work", settings: "settings", terminal: "terminal", monitor: "monitor" };
        if (!map[target]) throw new Error("Application inconnue");
        openPanel(map[target]);
        push("ok", `${target} ouvert.`);
      } else if (cmd.startsWith("new ")) {
        const name = cmd.slice(4).trim() || "Nouveau document.txt";
        void createTextDocument(name.endsWith(".txt") ? name : `${name}.txt`).then(async (file) => {
          await refreshFiles();
          await openDocument(file);
        });
        push("ok", `Document ${name} créé.`);
      } else if (cmd === "cells") {
        kernel.status().cells.forEach((cell) => push("system", `${cell.name} [${cell.id}] → ${cell.capabilityIds.length} capacité(s)`));
      } else if (cmd === "caps") {
        kernel.status().capabilities.forEach((cap) => push("system", `${cap.id} · ${cap.resource} · ${cap.rights.join(", ")} · ${cap.revoked ? "RÉVOQUÉE" : "active"}`));
      } else if (cmd === "demo") {
        const child = kernel.demo();
        setVersion((v) => v + 1);
        push("ok", `Capacité dérivée ${child.id} déléguée au Moniteur.`);
      } else if (cmd === "clear") {
        setLogs([]);
      } else if (cmd === "reboot") {
        kernel.reset();
        setVersion((v) => v + 1);
        setLogs([{ kind: "system", text: "Redémarrage terminé. Les fichiers personnels sont conservés." }]);
      } else {
        push("error", `Commande inconnue : ${cmd}`);
      }
    } catch (error) {
      push("error", error instanceof Error ? error.message : "Erreur système");
    }
  }

  const currentApp = apps.find((item) => item.id === panel);

  return (
    <div className="desktop-shell" style={{ background: wallpaperCss }}>
      <div className="desktop-tint" />
      <div className="desktop-topline">
        <div className="brand-chip">GraineOS</div>
        <div className="topline-right">
          <span className={storageReady ? "sync-state ready" : "sync-state"}>{storageError ? "Stockage indisponible" : storageReady ? "Stockage local prêt" : "Initialisation…"}</span>
          <span>FR</span>
        </div>
      </div>

      <div className="desktop-icons">
        {apps.filter((app) => app.desktop).map((app) => (
          <button key={app.id} className="desktop-icon" onDoubleClick={() => openPanel(app.id)} onClick={() => openPanel(app.id)}>
            <span className="desktop-icon-glyph">{app.icon}</span><span>{app.label}</span>
          </button>
        ))}
      </div>

      {launcherOpen && (
        <div className="launcher-panel glass-surface">
          <div className="launcher-heading"><strong>Applications</strong><span>GraineOS</span></div>
          <div className="launcher-grid">
            {apps.map((app) => <button key={app.id} onClick={() => openPanel(app.id)}><span>{app.icon}</span><small>{app.label}</small></button>)}
          </div>
        </div>
      )}

      {isVisible && (
        <section className={`window-shell ${windowState}`}>
          <header className="window-titlebar">
            <div className="window-title"><span>{currentApp?.icon}</span>{currentApp?.label}</div>
            <div className="window-controls traffic-lights" aria-label="Contrôles de la fenêtre">
              <button className="traffic-button red" onClick={closeWindow} title="Fermer" aria-label="Fermer" />
              <button className="traffic-button amber" onClick={() => setWindowState("minimized")} title="Réduire" aria-label="Réduire" />
              <button className="traffic-button green" onClick={() => setWindowState(windowState === "maximized" ? "normal" : "maximized")} title={windowState === "maximized" ? "Restaurer" : "Développer"} aria-label="Développer" />
            </div>
          </header>

          <div className="window-content">
            {panel === "files" && (
              <div className="explorer-layout">
                <aside className="explorer-sidebar">
                  <div className="sidebar-title">Emplacements</div>
                  {folders.map((item) => <button key={item} className={folder === item ? "sidebar-item active" : "sidebar-item"} onClick={() => setFolder(item)}><Folder size={16} />{item}</button>)}
                </aside>
                <section className="explorer-main">
                  <div className="app-toolbar">
                    <button className="primary-action" onClick={() => void newDocument()}><FilePlus2 size={16} />Nouveau texte</button>
                    <button onClick={() => fileInput.current?.click()}><Upload size={16} />Importer</button>
                    <div className="toolbar-search"><Search size={15} /><input placeholder="Rechercher" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                    <input ref={fileInput} hidden multiple type="file" onChange={(event) => void handleImport(event.target.files, folder)} />
                  </div>
                  <div className="pathbar"><span>GraineOS</span><ChevronRight size={14} /><strong>{folder}</strong><small>{visibleFiles.length} élément(s)</small></div>
                  <div className="file-table">
                    <div className="file-row file-head"><span>Nom</span><span>Type</span><span>Taille</span><span>Modifié</span><span /></div>
                    {visibleFiles.length === 0 && <div className="empty-state"><Folder size={36} /><strong>Ce dossier est vide</strong><p>Crée un document ou importe un fichier.</p></div>}
                    {visibleFiles.map((file) => (
                      <div className="file-row" key={file.id} onDoubleClick={() => file.kind === "text" ? void openDocument(file) : file.kind === "image" ? openPanel("photos") : downloadOSFile(file)}>
                        <span className="file-name">{file.kind === "image" ? <ImageIcon size={17} /> : file.kind === "text" ? <FileText size={17} /> : <File size={17} />}<strong>{file.name}</strong></span>
                        <span>{file.kind === "text" ? "Document texte" : file.kind === "image" ? "Image" : file.mime}</span>
                        <span>{formatSize(file.size)}</span><span>{formatDate(file.updatedAt)}</span>
                        <span className="row-actions"><button title="Télécharger" onClick={() => downloadOSFile(file)}><Download size={15} /></button><button title="Supprimer" onClick={() => void removeFile(file)}><Trash2 size={15} /></button></span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {panel === "text" && (
              <div className="text-app">
                <aside className="document-list">
                  <button className="primary-action full" onClick={() => void newDocument()}><Plus size={16} />Nouveau document</button>
                  {textFiles.map((file) => <button key={file.id} className={editingFile?.id === file.id ? "document-item active" : "document-item"} onClick={() => void openDocument(file)}><FileText size={16} /><span><strong>{file.name}</strong><small>{formatDate(file.updatedAt)}</small></span></button>)}
                </aside>
                <section className="editor-area">
                  {editingFile ? <>
                    <div className="editor-toolbar"><input className="document-title" value={docName} onChange={(event) => setDocName(event.target.value)} /><span className={`save-indicator ${saveState}`}><Save size={14} />{saveState === "saving" ? "Enregistrement…" : "Enregistré"}</span></div>
                    <textarea className="document-editor" value={docContent} onChange={(event) => setDocContent(event.target.value)} placeholder="Commence à écrire…" />
                    <div className="editor-status"><span>{docContent.length} caractères</span><span>{docContent.trim() ? docContent.trim().split(/\s+/).length : 0} mots</span><span>{editingFile.folder}</span></div>
                  </> : <div className="empty-state large"><FileText size={44} /><strong>Aucun document ouvert</strong><p>Choisis un document à gauche ou crée-en un nouveau.</p><button className="primary-action" onClick={() => void newDocument()}>Créer un document</button></div>}
                </section>
              </div>
            )}

            {panel === "photos" && (
              <div className="photos-app">
                <div className="app-toolbar"><button className="primary-action" onClick={() => imageInput.current?.click()}><Upload size={16} />Importer des images</button><span className="toolbar-note">{imageFiles.length} image(s)</span><input ref={imageInput} hidden multiple accept="image/*" type="file" onChange={(event) => void handleImport(event.target.files, "Images")} /></div>
                {imageFiles.length === 0 ? <div className="empty-state large"><ImageIcon size={48} /><strong>Aucune image</strong><p>Importe des photos, illustrations ou fonds d’écran.</p></div> : <div className="photo-grid">{imageFiles.map((file) => <article className="photo-card" key={file.id}><BlobImage file={file} className="photo-preview" /><div><strong>{file.name}</strong><small>{formatSize(file.size)}</small></div><div className="photo-actions"><button onClick={() => void changeWallpaper(`image:${file.id}`)}><Palette size={15} />Fond d’écran</button><button onClick={() => downloadOSFile(file)}><Download size={15} /></button><button onClick={() => void removeFile(file)}><Trash2 size={15} /></button></div></article>)}</div>}
              </div>
            )}

            {panel === "work" && (
              <div className="work-app">
                <div className="work-summary"><div><small>Progression globale</small><strong>{taskProgress}%</strong><div className="progress-track"><span style={{ width: `${taskProgress}%` }} /></div></div><div><small>Tâches terminées</small><strong>{completedTasks}/{tasks.length}</strong></div><div><small>En cours</small><strong>{tasks.filter((task) => task.status === "doing").length}</strong></div></div>
                <div className="task-create"><input placeholder="Nouvelle tâche" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addTask(); }} /><input placeholder="Projet" value={taskProject} onChange={(event) => setTaskProject(event.target.value)} /><button className="primary-action" onClick={() => void addTask()}><Plus size={16} />Ajouter</button></div>
                <div className="task-board">
                  {(["todo", "doing", "done"] as TaskStatus[]).map((status) => <section className="task-column" key={status}><div className="task-column-title"><strong>{status === "todo" ? "À faire" : status === "doing" ? "En cours" : "Terminé"}</strong><span>{tasks.filter((task) => task.status === status).length}</span></div>{tasks.filter((task) => task.status === status).map((task) => <article className="task-card" key={task.id}><small>{task.project}</small><strong>{task.title}</strong><div className="task-actions"><button onClick={() => void advanceTask(task)}>{status === "done" ? <ChevronRight size={15} /> : <Check size={15} />}{status === "todo" ? "Démarrer" : status === "doing" ? "Terminer" : "Recommencer"}</button><button onClick={() => void removeTask(task)}><Trash2 size={15} /></button></div></article>)}</section>)}
                </div>
              </div>
            )}

            {panel === "settings" && (
              <div className="settings-app">
                <aside className="settings-sidebar"><button className="active"><Palette size={16} />Apparence</button><button><Monitor size={16} />Bureau</button><button><Cpu size={16} />Système</button></aside>
                <section className="settings-content"><h2>Fond d’écran</h2><p>Choisis une ambiance système ou utilise l’une de tes images.</p><div className="wallpaper-grid">{Object.entries(wallpaperPresets).map(([id, background]) => <button key={id} className={wallpaper === `preset:${id}` ? "wallpaper-option selected" : "wallpaper-option"} style={{ background }} onClick={() => void changeWallpaper(`preset:${id}`)}><span>{id}</span></button>)}</div>{imageFiles.length > 0 && <><h3>Mes images</h3><div className="wallpaper-images">{imageFiles.slice(0, 8).map((file) => <button key={file.id} className={wallpaper === `image:${file.id}` ? "wallpaper-image selected" : "wallpaper-image"} onClick={() => void changeWallpaper(`image:${file.id}`)}><BlobImage file={file} /></button>)}</div></>}<div className="settings-info"><strong>Stockage local</strong><p>{files.length} fichier(s) et {tasks.length} tâche(s) sont conservés dans le navigateur via IndexedDB.</p></div></section>
              </div>
            )}

            {panel === "terminal" && <div className="terminal-panel"><div className="terminal-output">{logs.map((line, index) => <div key={index} className={`log ${line.kind}`}>{line.text}</div>)}</div><form className="terminal-input-row" onSubmit={(event) => { event.preventDefault(); run(command); setCommand(""); }}><span>graine@system %</span><input autoFocus value={command} onChange={(event) => setCommand(event.target.value)} /></form></div>}

            {panel === "monitor" && <div className="dashboard-grid"><article className="glass-card"><small>Fichiers personnels</small><strong>{files.length}</strong><p>Documents et médias persistants.</p></article><article className="glass-card"><small>Travail</small><strong>{taskProgress}%</strong><p>{completedTasks} tâche(s) terminée(s).</p></article><article className="glass-card"><small>Cellules noyau</small><strong>{kernelState.cells.length}</strong><p>Unités d’exécution isolées.</p></article><article className="glass-card"><small>Capacités</small><strong>{kernelState.capabilities.length}</strong><p>Droits détenus par jetons.</p></article><article className="glass-card wide"><small>État système</small><strong>{storageError ? "Dégradé" : "Stable"}</strong><p>Les données utilisateur sont séparées de la simulation du noyau et survivent aux redémarrages de l’interface.</p></article></div>}

            {panel === "about" && <div className="about-panel"><div className="os-mark">G</div><h1>GraineOS</h1><p>Environnement de bureau web local-first.</p><p>Fichiers, textes, images, suivi du travail, personnalisation et outils noyau fonctionnent dans une interface unique.</p></div>}
          </div>
        </section>
      )}

      <footer className="floating-taskbar">
        <button className={launcherOpen ? "launcher active" : "launcher"} onClick={() => setLauncherOpen((value) => !value)} title="Applications"><Grid2X2 size={19} /></button>
        <div className="taskbar-divider" />
        <div className="pinned-apps">{apps.slice(0, 6).map((app) => <button key={app.id} className={isVisible && panel === app.id ? "task-button active" : "task-button"} onClick={() => openPanel(app.id)} title={app.label}>{app.icon}</button>)}</div>
        <div className="system-tray"><Wifi size={17} /><span className="clock">{clock.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span><button className="power" onClick={() => run("reboot")} title="Redémarrer"><Power size={16} /></button></div>
      </footer>
    </div>
  );
}
