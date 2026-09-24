import { Kernel } from "./kernel";

// Instance de la VM web : le Shell reçoit la capacité racine, le Moniteur rien.
export const kernel = new Kernel({
  boot(k) {
    k.createCell("shell", "Shell");
    k.createCell("monitor", "Moniteur");
    k.mintRoot("shell", "/");
  },
});

export function demo() {
  const [rootId] = kernel.status().cells.find((cell) => cell.id === "shell")?.capabilityIds ?? [];
  if (!rootId) throw new Error("Cellule shell absente");
  return kernel.delegate("shell", rootId, "monitor", ["read", "execute"], "system");
}
