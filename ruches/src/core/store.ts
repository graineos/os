/**
 * Ruches — magasin d'octets local, dans le navigateur de l'appareil.
 *
 * Deux moteurs, choisis automatiquement :
 * - OPFS (Origin Private File System) : vrai système de fichiers privé du site, plusieurs Go possibles ;
 * - IndexedDB : secours pour les navigateurs sans écriture OPFS.
 * Aucun serveur, aucune clé, aucun service externe : les octets restent sur l'appareil.
 */
export interface ByteStore {
  readonly engine: "opfs" | "idb" | "memory";
  get(key: string): Promise<Uint8Array | null>;
  /** Contenu sous forme de Blob ; sur OPFS il reste sur le disque (rien n'est chargé en mémoire). */
  getBlob(key: string): Promise<Blob | null>;
  put(key: string, data: Uint8Array): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * Seule l'absence du fichier vaut « rien d'enregistré ». Toute autre erreur (E/S, droits, poignée
 * invalidée) remonte : la confondre avec un coffre vide ferait écrire un manifeste vide par-dessus le vrai.
 */
function absent(error: unknown): null {
  if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) return null;
  throw error;
}

class OpfsStore implements ByteStore {
  readonly engine = "opfs" as const;
  constructor(private root: FileSystemDirectoryHandle) {}

  private async locate(key: string, create: boolean) {
    const parts = key.split("/");
    const name = parts.pop() as string;
    let dir = this.root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return { dir, name };
  }

  async get(key: string) {
    try {
      const { dir, name } = await this.locate(key, false);
      const file = await (await dir.getFileHandle(name)).getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      return absent(error);
    }
  }

  async getBlob(key: string) {
    try {
      const { dir, name } = await this.locate(key, false);
      return await (await dir.getFileHandle(name)).getFile();
    } catch (error) {
      return absent(error);
    }
  }

  async put(key: string, data: Uint8Array) {
    const { dir, name } = await this.locate(key, true);
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(data as Uint8Array<ArrayBuffer>);
    await writable.close();
  }

  async del(key: string) {
    try {
      const { dir, name } = await this.locate(key, false);
      await dir.removeEntry(name);
    } catch {
      /* déjà absent */
    }
  }
}

class IdbStore implements ByteStore {
  readonly engine = "idb" as const;
  constructor(private db: IDBDatabase) {}

  private run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      const request = fn(this.db.transaction("kv", mode).objectStore("kv"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string) {
    const value = await this.run<Uint8Array | undefined>("readonly", (s) => s.get(key));
    return value ?? null;
  }
  async getBlob(key: string) {
    const value = await this.get(key);
    return value ? new Blob([value as Uint8Array<ArrayBuffer>]) : null;
  }
  /** Écriture confirmée seulement quand la transaction est validée (une transaction peut échouer après la requête). */
  private write(fn: (store: IDBObjectStore) => void) {
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction("kv", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Écriture annulée"));
      tx.onerror = () => reject(tx.error);
      fn(tx.objectStore("kv"));
    });
  }
  async put(key: string, data: Uint8Array) {
    await this.write((s) => s.put(data, key));
  }
  async del(key: string) {
    await this.write((s) => s.delete(key));
  }
}

/** Magasin en mémoire : tests, démonstrations, environnements sans stockage persistant. */
export class MemoryStore implements ByteStore {
  readonly engine = "memory" as const;
  private map = new Map<string, Uint8Array>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async getBlob(key: string) {
    const value = this.map.get(key);
    return value ? new Blob([value as Uint8Array<ArrayBuffer>]) : null;
  }
  async put(key: string, data: Uint8Array) {
    this.map.set(key, data.slice());
  }
  async del(key: string) {
    this.map.delete(key);
  }
  get size() {
    return this.map.size;
  }
}

function openIdb(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kv");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Ouvre le magasin de l'espace `ns` (un espace par compte, isolé des autres). */
export async function openByteStore(ns: string): Promise<ByteStore> {
  const safe = ns.replace(/[^a-z0-9_-]/gi, "_");
  try {
    const canWrite = typeof FileSystemFileHandle !== "undefined" && "createWritable" in FileSystemFileHandle.prototype;
    if (canWrite && navigator.storage?.getDirectory) {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle("ruche", { create: true })).getDirectoryHandle(safe, { create: true });
      return new OpfsStore(dir);
    }
  } catch {
    /* OPFS refusé (navigation privée…) : on passe à IndexedDB */
  }
  return new IdbStore(await openIdb(`ruche-${safe}`));
}
