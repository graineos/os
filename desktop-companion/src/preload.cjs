const {contextBridge, ipcRenderer} = require('electron');
const allowed = new Set(['show','hide','launch','app-list','settings-get','settings-set','open-settings','open-launchpad','open-search','quit','minimize-windows','open-folder','open-control','open-finder','open-activity','files','file-open','activity-list','window-focus','open-windows-settings','system-info','system-control','legacy-scan','app-icon','companion-status','companion-refresh','performance','window-control','window-state','file-preview','finder-operation']);
contextBridge.exposeInMainWorld('ruche', {
  invoke: (name, value) => {
    if (!allowed.has(name)) return Promise.reject(new Error('Action non autorisée'));
    return ipcRenderer.invoke(`ruche:${name}`, value);
  },
  onApps: cb => {const handler=(_event,apps)=>cb(apps);ipcRenderer.on('ruche:apps',handler);return ()=>ipcRenderer.removeListener('ruche:apps',handler)},
  onPerformance: cb => {const handler=(_event,value)=>cb(value);ipcRenderer.on('ruche:performance',handler);return ()=>ipcRenderer.removeListener('ruche:performance',handler)},
  onSettings: cb => {const handler=(_event,settings)=>cb(settings);ipcRenderer.on('ruche:settings',handler);return ()=>ipcRenderer.removeListener('ruche:settings',handler)}
});
