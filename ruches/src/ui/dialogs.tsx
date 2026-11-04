import { useEffect, useState } from "react";
import { Check, Download, Folder, Hexagon, History, Home, RotateCcw } from "lucide-react";
import type { RucheNode } from "../core/vault";
import { Dialog, useToast } from "./kit";
import { ago, formatBytes, safeColor, saveBlob, useVault } from "./shared";

/** Saisie d'un nom (nouveau dossier, renommage, nouvel espace…). */
export function NameDialog({ open, title, initial, confirm, onClose, onSubmit }: { open: boolean; title: string; initial: string; confirm: string; onClose: () => void; onSubmit: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}>
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} aria-label="Nom" className="ru-field"
          onFocus={(e) => { const dot = e.target.value.lastIndexOf("."); e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length); }} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="ru-chip" onClick={onClose}>Annuler</button>
          <button type="submit" className="ru-chip" data-strong="true" disabled={!value.trim()}>{confirm}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Choix du dossier de destination. */
export function MoveDialog({ node, onClose }: { node: RucheNode | null; onClose: () => void }) {
  const { vault } = useVault();
  const toast = useToast();
  if (!vault) return null;
  const folders = vault.all().filter((n) => n.kind === "folder" && !vault.isTrashed(n) && node && !vault.path(n.id).some((p) => p.id === node.id));
  const move = async (parent: string | null) => {
    if (!node) return;
    try {
      await vault.update(node.id, { parent });
      toast.ok("Déplacé");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Déplacement impossible.");
    }
  };
  return (
    <Dialog open={!!node} onClose={onClose} title={`Déplacer « ${node?.name ?? ""} »`} description="Choisis le dossier de destination.">
      <div className="max-h-[50vh] space-y-1 overflow-y-auto">
        <button type="button" className="ru-row w-full text-left" onClick={() => move(null)} disabled={node?.parent === null}><Home className="h-5 w-5" aria-hidden /> Racine</button>
        {folders.map((f) => (
          <button key={f.id} type="button" className="ru-row w-full text-left" onClick={() => move(f.id)} disabled={node?.parent === f.id}>
            <Folder className="h-5 w-5 shrink-0" style={{ color: "var(--ru-honey)" }} aria-hidden />
            <span className="truncate">{vault.path(f.id).map((p) => p.name).join(" / ")}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/** Rattacher un objet à des espaces : une case par espace, aucune copie. */
export function SpacesDialog({ node, onClose }: { node: RucheNode | null; onClose: () => void }) {
  const { vault } = useVault();
  if (!vault) return null;
  const spaces = vault.objects("space");
  const current = node ? vault.node(node.id) : undefined;
  return (
    <Dialog open={!!node} onClose={onClose} title="Espaces" description={`« ${node?.name ?? ""} » peut vivre dans plusieurs espaces à la fois, sans être copié.`}>
      {spaces.length ? (
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {spaces.map((sp) => {
            const on = current?.spaces?.includes(sp.id) ?? false;
            return (
              <button key={sp.id} type="button" role="checkbox" aria-checked={on} className="ru-row w-full text-left" onClick={() => node && void vault.toggleSpace(node.id, sp.id)}>
                <Hexagon className="h-5 w-5 shrink-0" style={{ color: safeColor(sp.props?.color) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{sp.name}</span>
                <span className="grid h-6 w-6 place-items-center rounded-md border" style={{ borderColor: "var(--ru-line-strong)", background: on ? "var(--ru-honey-deep)" : "transparent", color: "#fff" }}>{on ? <Check className="h-4 w-4" aria-hidden /> : null}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] text-[var(--ru-muted)]">Aucun espace pour l’instant. Crée-en un depuis l’onglet Espaces.</p>
      )}
    </Dialog>
  );
}

/** Historique des versions : chaque version ne coûte que les alvéoles qui ont changé. */
export function HistoryDialog({ node, onClose, onPreview, onRestored }: { node: RucheNode | null; onClose: () => void; onPreview?: (index: number) => void; onRestored?: () => void }) {
  const { vault } = useVault();
  const toast = useToast();
  if (!vault) return null;
  const versions = node ? node.versions.map((v, i) => ({ v, i })).reverse() : [];
  const fresh = (i: number) => {
    if (!node || i === 0) return null;
    const before = new Set(node.versions[i - 1].chunks);
    const changed = node.versions[i].chunks.filter((h) => !before.has(h)).length;
    return `${changed} alvéole${changed > 1 ? "s" : ""} nouvelle${changed > 1 ? "s" : ""}`;
  };
  const count = node?.versions.length ?? 0;
  return (
    <Dialog open={!!node} onClose={onClose} title={<span className="flex items-center gap-2"><History className="h-5 w-5" aria-hidden /> Historique</span>} description={`${node?.name ?? ""} · ${count} version${count > 1 ? "s" : ""} conservée${count > 1 ? "s" : ""} (40 au maximum).`}>
      <ol className="max-h-[55vh] space-y-1 overflow-y-auto">
        {versions.map(({ v, i }) => (
          <li key={`${v.at}-${i}`} className="ru-row">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">{i === count - 1 ? "Version actuelle" : new Date(v.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span>
              <span className="block text-[12px] text-[var(--ru-muted)]">{ago(v.at)} · {formatBytes(v.size)}{fresh(i) ? ` · ${fresh(i)}` : ""}</span>
            </span>
            {onPreview ? <button type="button" className="ru-chip !min-h-9 !px-3 !text-[13px]" onClick={() => onPreview(i)}>Voir</button> : null}
            <button type="button" className="ru-icon-btn" title="Télécharger cette version" aria-label="Télécharger cette version" onClick={async () => node && saveBlob(await vault.read(node.id, i), node.name)}><Download className="h-4 w-4" aria-hidden /></button>
            {i !== count - 1 ? (
              <button type="button" className="ru-icon-btn" title="Restaurer" aria-label="Restaurer cette version" onClick={async () => { if (!node) return; await vault.restore(node.id, i); toast.ok("Version restaurée (l’actuelle reste dans l’historique)"); onRestored?.(); onClose(); }}><RotateCcw className="h-4 w-4" aria-hidden /></button>
            ) : null}
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
