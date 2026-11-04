/**
 * Kit d'interface de Ruches : dialogues, menus, bulles, confirmation et notifications.
 * Construit directement sur Radix (accessibilité clavier et lecteurs d'écran), sans dépendre de l'hôte.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

/** Les fenêtres s'affichent hors de l'arbre (portail) : elles reprennent le thème par ce contexte. */
export const ThemeContext = createContext<"light" | "dark">("light");
const useMode = () => useContext(ThemeContext);

// ——— Dialogue ———

export function Dialog({ open, onClose, title, description, children, wide = false, bare = false }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; wide?: boolean; bare?: boolean }) {
  const mode = useMode();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ru-overlay" />
        <DialogPrimitive.Content className={`ru ru-dialog ${wide ? "ru-dialog-wide" : ""}`} data-theme={mode}>
          <div className={bare ? "sr-only" : "mb-3 flex items-start gap-3"}>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[18px] font-semibold leading-tight">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="mt-1 text-[13.5px] text-[var(--ru-muted)]">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : ""}</DialogPrimitive.Description>}
            </div>
            {!bare ? (
              <DialogPrimitive.Close className="ru-icon-btn -mr-2 -mt-1 shrink-0" aria-label="Fermer"><X className="h-5 w-5" aria-hidden /></DialogPrimitive.Close>
            ) : null}
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Confirmation explicite avant une action irréversible. */
export function Confirm({ open, title, text, confirm, danger = false, onCancel, onConfirm }: { open: boolean; title: string; text: ReactNode; confirm: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} description={text}>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="ru-chip" onClick={onCancel} autoFocus>Annuler</button>
        <button type="button" className="ru-chip" data-strong={!danger} data-danger={danger} onClick={onConfirm}>{confirm}</button>
      </div>
    </Dialog>
  );
}

// ——— Menu ———

export function Menu({ trigger, label, children, align = "end" }: { trigger: ReactNode; label: string; children: ReactNode; align?: "start" | "end" }) {
  const mode = useMode();
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger className="ru-icon-btn shrink-0" aria-label={label} title={label}>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content align={align} sideOffset={6} className="ru ru-menu" data-theme={mode}>{children}</MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

export function MenuItem({ icon, children, onSelect, danger = false }: { icon?: ReactNode; children: ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <MenuPrimitive.Item className="ru-menu-item" data-danger={danger} onSelect={onSelect}>
      {icon ? <span className="grid h-5 w-5 place-items-center [&>svg]:h-4 [&>svg]:w-4" aria-hidden>{icon}</span> : null}
      {children}
    </MenuPrimitive.Item>
  );
}

export const MenuSeparator = () => <MenuPrimitive.Separator className="my-1 h-px bg-[var(--ru-line)]" />;

// ——— Bulle ———

export function Popover({ trigger, label, children }: { trigger: ReactNode; label: string; children: ReactNode }) {
  const mode = useMode();
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger className="ru-icon-btn shrink-0" aria-label={label} title={label}>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} className="ru ru-menu w-72 p-3 text-[13px]" data-theme={mode}>{children}</PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ——— Notifications ———

type Toast = { id: number; kind: "ok" | "error" | "info"; text: string; action?: { label: string; run: () => void } };
type Notify = {
  ok: (text: string, action?: Toast["action"]) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};
const ToastContext = createContext<Notify>({ ok: () => undefined, error: () => undefined, info: () => undefined });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((all) => [...all.slice(-2), { ...toast, id }]);
    window.setTimeout(() => dismiss(id), toast.action ? 7000 : 4000);
  }, [dismiss]);
  const api = useRef<Notify>({ ok: () => undefined, error: () => undefined, info: () => undefined });
  api.current = {
    ok: (text, action) => push({ kind: "ok", text, action }),
    error: (text) => push({ kind: "error", text }),
    info: (text) => push({ kind: "info", text }),
  };
  const [stable] = useState<Notify>(() => ({ ok: (t, a) => api.current.ok(t, a), error: (t) => api.current.error(t), info: (t) => api.current.info(t) }));
  return (
    <ToastContext.Provider value={stable}>
      {children}
      <div className="ru-toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="ru-toast">
              {t.kind === "ok" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--ru-ok)]" aria-hidden /> : t.kind === "error" ? <CircleAlert className="h-5 w-5 shrink-0 text-[var(--ru-danger)]" aria-hidden /> : <Info className="h-5 w-5 shrink-0 text-[var(--ru-honey)]" aria-hidden />}
              <span className="min-w-0 flex-1">{t.text}</span>
              {t.action ? <button type="button" className="shrink-0 font-semibold text-[var(--ru-honey)]" onClick={() => { t.action?.run(); dismiss(t.id); }}>{t.action.label}</button> : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Thème : celui demandé par l'hôte, sinon celui du système (et de la classe .dark de la page). */
export function useTheme(preference: "light" | "dark" | "auto") {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (preference !== "auto") return setDark(preference === "dark");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const html = document.documentElement;
    const sync = () => setDark(html.classList.contains("dark") || (!html.classList.contains("light") && media.matches));
    sync();
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, [preference]);
  return dark;
}
