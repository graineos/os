export type SystemFolder = "Bureau" | "Documents" | "Images" | "Travail";
export type FileKind = "text" | "image" | "binary";
export type TaskStatus = "todo" | "doing" | "done";

export type OSFile = {
  id: string;
  name: string;
  folder: SystemFolder;
  kind: FileKind;
  mime: string;
  size: number;
  content?: string;
  blob?: Blob;
  createdAt: number;
  updatedAt: number;
};

export type WorkTask = {
  id: string;
  title: string;
  project: string;
  notes: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
};

export type OSSettings = {
  wallpaper: string;
};

const DB_NAME = "graineos-desktop";
const DB_VERSION = 1;
const FILES = "files";
const TASKS = "tasks";
const SETTINGS = "settings";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Erreur IndexedDB"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Transaction IndexedDB impossible"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction IndexedDB annulée"));
  });
}

let databasePromise: Promise<IDBDatabase> | null = null;

export function openDesktopDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILES)) {
        const files = db.createObjectStore(FILES, { keyPath: "id" });
        files.createIndex("folder", "folder", { unique: false });
        files.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(TASKS)) {
        const tasks = db.createObjectStore(TASKS, { keyPath: "id" });
        tasks.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS)) {
        db.createObjectStore(SETTINGS, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir le stockage GraineOS"));
  });
  return databasePromise;
}

async function getAll<T>(storeName: string) {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(storeName, "readonly");
  const result = await requestToPromise(transaction.objectStore(storeName).getAll());
  await transactionDone(transaction);
  return result as T[];
}

export async function listFiles() {
  const files = await getAll<OSFile>(FILES);
  return files.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getFile(id: string) {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(FILES, "readonly");
  const result = await requestToPromise(transaction.objectStore(FILES).get(id));
  await transactionDone(transaction);
  return result as OSFile | undefined;
}

export async function saveFile(file: OSFile) {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(FILES, "readwrite");
  transaction.objectStore(FILES).put(file);
  await transactionDone(transaction);
  return file;
}

export async function deleteFile(id: string) {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(FILES, "readwrite");
  transaction.objectStore(FILES).delete(id);
  await transactionDone(transaction);
}

export async function createTextDocument(name = "Nouveau document.txt", folder: SystemFolder = "Documents") {
  const now = Date.now();
  return saveFile({
    id: uid("file"),
    name,
    folder,
    kind: "text",
    mime: "text/plain",
    size: 0,
    content: "",
    createdAt: now,
    updatedAt: now,
  });
}

export async function importBrowserFile(file: File, folder?: SystemFolder) {
  const now = Date.now();
  const kind: FileKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("text/") ? "text" : "binary";
  const targetFolder = folder ?? (kind === "image" ? "Images" : kind === "text" ? "Documents" : "Bureau");
  const record: OSFile = {
    id: uid("file"),
    name: file.name,
    folder: targetFolder,
    kind,
    mime: file.type || "application/octet-stream",
    size: file.size,
    blob: file,
    createdAt: now,
    updatedAt: now,
  };
  if (kind === "text") {
    record.content = await file.text();
    record.size = new Blob([record.content]).size;
  }
  return saveFile(record);
}

export function fileAsBlob(file: OSFile) {
  if (file.blob) return file.blob;
  return new Blob([file.content ?? ""], { type: file.mime || "text/plain" });
}

export function downloadOSFile(file: OSFile) {
  const url = URL.createObjectURL(fileAsBlob(file));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function listTasks() {
  const tasks = await getAll<WorkTask>(TASKS);
  return tasks.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveTask(task: WorkTask) {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(TASKS, "readwrite");
  transaction.objectStore(TASKS).put(task);
  await transactionDone(transaction);
  return task;
}

export async function createTask(title: string, project = "Général") {
  const now = Date.now();
  return saveTask({
    id: uid("task"),
    title,
    project,
    notes: "",
    status: "todo",
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteTask(id: string) {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(TASKS, "readwrite");
  transaction.objectStore(TASKS).delete(id);
  await transactionDone(transaction);
}

export async function getSettings(): Promise<OSSettings> {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(SETTINGS, "readonly");
  const value = await requestToPromise(transaction.objectStore(SETTINGS).get("desktop"));
  await transactionDone(transaction);
  return (value as { key: string; value: OSSettings } | undefined)?.value ?? { wallpaper: "preset:aurora" };
}

export async function saveSettings(settings: OSSettings) {
  const db = await openDesktopDatabase();
  const transaction = db.transaction(SETTINGS, "readwrite");
  transaction.objectStore(SETTINGS).put({ key: "desktop", value: settings });
  await transactionDone(transaction);
  return settings;
}
