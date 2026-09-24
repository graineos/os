// Noyau GraineOS : modèle cellules / capacités, sans dépendance (ni DOM, ni React).
// Ce fichier est copié tel quel dans d'autres projets (ex. angel-leclerc.fr) :
// il doit rester autonome.

export const KERNEL_VERSION = "0.2.0";

export type Right = "read" | "write" | "execute" | "delegate";

export const ALL_RIGHTS: readonly Right[] = ["read", "write", "execute", "delegate"];

export type Capability = {
  id: string;
  /** Portée hiérarchique : "/" couvre tout, "site/admin" couvre "site/admin/actualites". */
  resource: string;
  rights: Set<Right>;
  /** Cellule qui détient la capacité. */
  holder: string;
  parentId?: string;
  revoked: boolean;
};

export type Cell = {
  id: string;
  name: string;
  capabilityIds: string[];
};

export type KernelOptions = {
  /** Cellules et capacités initiales, rejouées à chaque reset(). */
  boot?: (kernel: Kernel) => void;
  idGenerator?: (prefix: string) => string;
};

export class KernelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KernelError";
  }
}

function normalizeResource(resource: string) {
  const trimmed = resource.trim().replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : trimmed;
}

/** Une portée couvre une ressource si elle est égale ou parente (par segments). */
export function covers(scope: string, resource: string) {
  const s = normalizeResource(scope);
  const r = normalizeResource(resource);
  return s === "/" || r === s || r.startsWith(`${s}/`);
}

export class Kernel {
  private capabilities = new Map<string, Capability>();
  private cells = new Map<string, Cell>();
  private counter = 0;
  private readonly options: KernelOptions;

  constructor(options: KernelOptions = {}) {
    this.options = options;
    this.reset();
  }

  reset() {
    this.capabilities.clear();
    this.cells.clear();
    this.counter = 0;
    this.options.boot?.(this);
  }

  private id(prefix: string) {
    if (this.options.idGenerator) return this.options.idGenerator(prefix);
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  private requireCell(cellId: string) {
    const cell = this.cells.get(cellId);
    if (!cell) throw new KernelError(`Cellule inconnue : ${cellId}`);
    return cell;
  }

  private requireCapability(capabilityId: string) {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) throw new KernelError(`Capacité inconnue : ${capabilityId}`);
    return cap;
  }

  private attach(cellId: string, cap: Capability) {
    this.capabilities.set(cap.id, cap);
    this.requireCell(cellId).capabilityIds.push(cap.id);
    return cap;
  }

  createCell(id: string, name = id) {
    if (this.cells.has(id)) throw new KernelError(`Cellule déjà existante : ${id}`);
    const cell: Cell = { id, name, capabilityIds: [] };
    this.cells.set(id, cell);
    return cell;
  }

  /** Seul point d'entrée qui crée des droits ex nihilo : réservé au démarrage. */
  mintRoot(cellId: string, resource = "/", rights: readonly Right[] = ALL_RIGHTS) {
    return this.attach(cellId, {
      id: this.id("cap"),
      resource: normalizeResource(resource),
      rights: new Set(rights),
      holder: cellId,
      revoked: false,
    });
  }

  /**
   * Délègue une capacité atténuée : la cellule source doit détenir la capacité,
   * avoir le droit "delegate", et ne peut transmettre que des droits et une portée
   * inclus dans les siens.
   */
  delegate(fromCellId: string, capabilityId: string, toCellId: string, rights: readonly Right[], resource?: string) {
    this.requireCell(toCellId);
    const source = this.requireCapability(capabilityId);
    if (source.holder !== fromCellId) throw new KernelError(`${fromCellId} ne détient pas ${capabilityId}`);
    if (source.revoked) throw new KernelError(`Capacité révoquée : ${capabilityId}`);
    if (!source.rights.has("delegate")) throw new KernelError(`${capabilityId} n'autorise pas la délégation`);
    for (const right of rights) {
      if (!source.rights.has(right)) throw new KernelError(`Droit non délégable : ${right}`);
    }
    const scope = normalizeResource(resource ?? source.resource);
    if (!covers(source.resource, scope)) throw new KernelError(`Portée hors de ${source.resource} : ${scope}`);

    return this.attach(toCellId, {
      id: this.id("cap"),
      resource: scope,
      rights: new Set(rights),
      holder: toCellId,
      parentId: source.id,
      revoked: false,
    });
  }

  /** Révoque une capacité et toutes celles qui en dérivent. */
  revoke(capabilityId: string) {
    const target = this.capabilities.get(capabilityId);
    if (!target) return;
    target.revoked = true;
    for (const cap of this.capabilities.values()) {
      if (cap.parentId === capabilityId && !cap.revoked) this.revoke(cap.id);
    }
  }

  /** La question centrale : cette cellule peut-elle exercer ce droit sur cette ressource ? */
  check(cellId: string, resource: string, right: Right) {
    const cell = this.cells.get(cellId);
    if (!cell) return false;
    return cell.capabilityIds.some((capId) => {
      const cap = this.capabilities.get(capId);
      return !!cap && !cap.revoked && cap.rights.has(right) && covers(cap.resource, resource);
    });
  }

  status() {
    return {
      version: KERNEL_VERSION,
      cells: [...this.cells.values()].map((cell) => ({ ...cell, capabilityIds: [...cell.capabilityIds] })),
      capabilities: [...this.capabilities.values()].map((cap) => ({
        ...cap,
        rights: [...cap.rights],
      })),
    };
  }
}
