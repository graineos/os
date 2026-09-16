import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppWindow, Cpu, Gauge, Grid2X2, Monitor, Power, Terminal, Wifi } from "lucide-react";
import { kernel } from "./kernel/kernel";
import "./styles.css";

type Panel = "terminal" | "monitor" | "capabilities" | "cells" | "about";

type LogLine = { kind: "system" | "user" | "ok" | "error"; text: string };

const apps: { id: Panel; label: string; icon: React.ReactNode }[] = [
  { id: "terminal", label: "Terminal", icon: <Terminal size={18} /> },
  { id: "monitor", label: "Moniteur", icon: <Gauge size={18} /> },
  { id: "capabilities", label: "Capacités", icon: <Cpu size={18} /> },
  { id: "cells", label: "Cellules", icon: <Grid2X2 size={18} /> },
  { id: "about", label: "À propos", icon: <AppWindow size={18} /> },
];

function App() {
  const [panel, setPanel] = useState<Panel>("terminal");
  const [version, setVersion] = useState(0);
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([
    { kind: "system", text: "GraineOS 0.1 — noyau-graine initialisé" },
    { kind: "system", text: "Tape help pour afficher les commandes." },
  ]);
  const [windowState, setWindowState] = useState<"normal" | "minimized" | "maximized">("normal");
  const [isVisible, setIsVisible] = useState(true);

  const state = useMemo(() => kernel.status(), [version]);

  function push(kind: LogLine["kind"], text: string) {
    setLogs((current) => [...current, { kind, text }]);
  }

  function openPanel(nextPanel: Panel) {
    setPanel(nextPanel);
    setIsVisible(true);
    setWindowState("normal");
  }

  function closeWindow() {
    setIsVisible(false);
    setWindowState("normal");
  }

  function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    push("user", `graine@system % ${cmd}`);

    try {
      if (cmd === "help") {
        push("system", "help · status · cells · caps · demo · revoke <id> · clear · reboot");
      } else if (cmd === "status") {
        const s = kernel.status();
        push("ok", `${s.cells.length} cellules · ${s.capabilities.length} capacités`);
      } else if (cmd === "cells") {
        kernel.status().cells.forEach((cell) => push("system", `${cell.name} [${cell.id}] → ${cell.capabilityIds.length} capacité(s)`));
      } else if (cmd === "caps") {
        kernel.status().capabilities.forEach((cap) => push("system", `${cap.id} · ${cap.resource} · ${cap.rights.join(", ")} · ${cap.revoked ? "RÉVOQUÉE" : "active"}`));
      } else if (cmd === "demo") {
        const child = kernel.demo();
        setVersion((v) => v + 1);
        push("ok", `Capacité dérivée ${child.id} déléguée à Moniteur.`);
      } else if (cmd.startsWith("revoke ")) {
        const id = cmd.slice(7).trim();
        kernel.revoke(id);
        setVersion((v) => v + 1);
        push("ok", `Révocation demandée pour ${id}.`);
      } else if (cmd === "clear") {
        setLogs([]);
      } else if (cmd === "reboot") {
        kernel.reset();
        setVersion((v) => v + 1);
        setLogs([{ kind: "system", text: "Redémarrage terminé. GraineOS prêt." }]);
      } else {
        push("error", `Commande inconnue : ${cmd}`);
      }
    } catch (error) {
      push("error", error instanceof Error ? error.message : "Erreur système");
    }
  }

  if (!isVisible) {
    return (
      <div className="desktop-shell">
        <div className="wallpaper-glow glow-one" />
        <div className="wallpaper-glow glow-two" />

        <div className="desktop-topline">
          <div className="brand-chip">GraineOS</div>
          <div className="topline-right"><span>Prototype VM</span><span>FR</span></div>
        </div>

        <footer className="floating-taskbar">
          <button className="launcher" onClick={() => openPanel("about")}><Grid2X2 size={19} /></button>
          <div className="taskbar-divider" />
          <div className="pinned-apps">
            {apps.slice(0, 4).map((app) => <button key={app.id} className={panel === app.id ? "task-button active" : "task-button"} onClick={() => openPanel(app.id)} title={app.label}>{app.icon}</button>)}
          </div>
          <div className="system-tray"><Wifi size={17} /><Monitor size={17} /><span className="clock">09:41</span><button className="power" onClick={() => run("reboot")}><Power size={16} /></button></div>
        </footer>
      </div>
    );
  }

  return (
    <div className="desktop-shell">
      <div className="wallpaper-glow glow-one" />
      <div className="wallpaper-glow glow-two" />

      <div className="desktop-topline">
        <div className="brand-chip">GraineOS</div>
        <div className="topline-right"><span>Prototype VM</span><span>FR</span></div>
      </div>

      <section className={`window-shell ${windowState}`}>
        <header className="window-titlebar">
          <div className="window-title">{apps.find((item) => item.id === panel)?.label}</div>
          <div className="window-controls traffic-lights" aria-label="Contrôles de la fenêtre">
            <button
              className="traffic-button red"
              onClick={closeWindow}
              title="Fermer"
              aria-label="Fermer"
            />
            <button
              className="traffic-button amber"
              onClick={() => setWindowState("minimized")}
              title="Réduire"
              aria-label="Réduire"
            />
            <button
              className="traffic-button green"
              onClick={() => setWindowState(windowState === "maximized" ? "normal" : "maximized")}
              title={windowState === "maximized" ? "Restaurer" : "Développer"}
              aria-label={windowState === "maximized" ? "Restaurer" : "Développer"}
            />
          </div>
        </header>

        <div className="window-content">
          {panel === "terminal" && (
            <div className="terminal-panel">
              <div className="terminal-output">
                {logs.map((line, index) => <div key={index} className={`log ${line.kind}`}>{line.text}</div>)}
              </div>
              <form className="terminal-input-row" onSubmit={(event) => { event.preventDefault(); run(command); setCommand(""); }}>
                <span>graine@system %</span>
                <input autoFocus value={command} onChange={(e) => setCommand(e.target.value)} />
              </form>
            </div>
          )}

          {panel === "monitor" && (
            <div className="dashboard-grid">
              <article className="glass-card"><small>Cellules actives</small><strong>{state.cells.length}</strong><p>Unités d'exécution isolées.</p></article>
              <article className="glass-card"><small>Capacités</small><strong>{state.capabilities.length}</strong><p>Droits détenus par jetons.</p></article>
              <article className="glass-card wide"><small>État noyau</small><strong>Stable</strong><p>Simulation locale · aucune dépendance réseau nécessaire.</p></article>
            </div>
          )}

          {panel === "capabilities" && (
            <div className="list-panel">
              {state.capabilities.map((cap) => (
                <div className="list-row" key={cap.id}><div><strong>{cap.resource}</strong><small>{cap.id}</small></div><div className="right-meta"><span>{cap.rights.join(" · ")}</span><b>{cap.revoked ? "révoquée" : "active"}</b></div></div>
              ))}
            </div>
          )}

          {panel === "cells" && (
            <div className="list-panel">
              {state.cells.map((cell) => <div className="list-row" key={cell.id}><div><strong>{cell.name}</strong><small>{cell.id}</small></div><div className="right-meta">{cell.capabilityIds.length} capacité(s)</div></div>)}
            </div>
          )}

          {panel === "about" && (
            <div className="about-panel"><div className="os-mark">G</div><h1>GraineOS</h1><p>Prototype convergent, minimaliste et modulaire.</p><p>L'identité visuelle reprend les codes d'un système d'exploitation classique, mais revu pour l'époque contemporaine.</p></div>
          )}
        </div>
      </section>

      <footer className="floating-taskbar">
        <button className="launcher" onClick={() => openPanel("about")}><Grid2X2 size={19} /></button>
        <div className="taskbar-divider" />
        <div className="pinned-apps">
          {apps.slice(0, 4).map((app) => <button key={app.id} className={panel === app.id ? "task-button active" : "task-button"} onClick={() => openPanel(app.id)} title={app.label}>{app.icon}</button>)}
        </div>
        <div className="system-tray"><Wifi size={17} /><Monitor size={17} /><span className="clock">09:41</span><button className="power" onClick={() => run("reboot")}><Power size={16} /></button></div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
