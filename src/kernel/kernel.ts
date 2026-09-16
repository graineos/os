export type Right = "read" | "write" | "execute" | "delegate";

export type Capability = {
  id: string;
  resource: string;
  rights: Set<Right>;
  parentId?: string;
  revoked: boolean;
};

export type Cell = {
  id: string;
  name: string;
  capabilityIds: string[];
};

export class Kernel {
  private capabilities = new Map<string, Capability>();
  private cells = new Map<string, Cell>();

  constructor() {
    this.reset();
  }

  reset() {
    this.capabilities.clear();
    this.cells.clear();

    const root = this.createCapability("system", ["read", "write", "execute", "delegate"]);
    this.cells.set("shell", { id: "shell", name: "Shell", capabilityIds: [root.id] });
    this.cells.set("monitor", { id: "monitor", name: "Moniteur", capabilityIds: [] });
  }

  private id(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }

  createCapability(resource: string, rights: Right[], parentId?: string) {
    const cap: Capability = {
      id: this.id("cap"),
      resource,
      rights: new Set(rights),
      parentId,
      revoked: false,
    };
    this.capabilities.set(cap.id, cap);
    return cap;
  }

  splitCapability(capabilityId: string, rights: Right[]) {
    const source = this.capabilities.get(capabilityId);
    if (!source || source.revoked) throw new Error("Capacité source indisponible");
    const requested = new Set(rights);
    for (const right of requested) {
      if (!source.rights.has(right)) throw new Error(`Droit non délégable: ${right}`);
    }
    if (requested.size === source.rights.size) {
      throw new Error("La scission doit réduire strictement les droits");
    }
    return this.createCapability(source.resource, [...requested], source.id);
  }

  grant(cellId: string, capabilityId: string) {
    const cell = this.cells.get(cellId);
    const cap = this.capabilities.get(capabilityId);
    if (!cell || !cap || cap.revoked) throw new Error("Délégation impossible");
    if (!cell.capabilityIds.includes(capabilityId)) cell.capabilityIds.push(capabilityId);
  }

  revoke(capabilityId: string) {
    const target = this.capabilities.get(capabilityId);
    if (!target) return;
    target.revoked = true;
    for (const cap of this.capabilities.values()) {
      if (cap.parentId === capabilityId) this.revoke(cap.id);
    }
  }

  status() {
    return {
      cells: [...this.cells.values()].map((cell) => ({ ...cell })),
      capabilities: [...this.capabilities.values()].map((cap) => ({
        ...cap,
        rights: [...cap.rights],
      })),
    };
  }

  demo() {
    const shell = this.cells.get("shell");
    if (!shell) throw new Error("Cellule shell absente");
    const rootId = shell.capabilityIds[0];
    const child = this.splitCapability(rootId, ["read", "execute"]);
    this.grant("monitor", child.id);
    return child;
  }
}

export const kernel = new Kernel();
