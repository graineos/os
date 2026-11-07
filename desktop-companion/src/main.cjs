'use strict';
const {app,BrowserWindow,screen,ipcMain,shell,nativeTheme,globalShortcut,Tray,Menu,nativeImage,powerMonitor} = require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {execFile,spawn}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
const WINDOWS=process.platform==='win32';
const iconCache=new Map();
const {validWindowTarget,normalizeSettings,processMatch,performanceTier}=require('./ruche-core.cjs');
const {FinderService}=require('./finder-service.cjs');
const defaults={accent:'#bdd8fb',glass:0.75,autostart:false,hideTaskbar:false,pinned:['explorer','browser','terminal','settings'],theme:'light',wallpaper:'aurora',desktopMode:false,reduceMotion:false,companionMode:true,performanceMode:'adaptive'};
let settings={...defaults},windows={},installed=[],tray=null,companion={running:false,names:[],checkedAt:null},performance={tier:'balanced',appMemoryMB:0,appCpuPercent:0,battery:false};let previousCpu=process.cpuUsage(),previousSample=process.hrtime.bigint(),sampleTimer=null;
let finderService=null;
const builtins=[
 {id:'explorer',name:'Explorateur',icon:'📁',type:'builtin'},
 {id:'browser',name:'Navigateur',icon:'🌐',type:'builtin'},
 {id:'terminal',name:'Terminal',icon:'⌘',type:'builtin'},
 {id:'settings',name:'Paramètres Windows',icon:'⚙️',type:'builtin'},
 {id:'notepad',name:'Bloc-notes',icon:'📝',type:'builtin'},
 {id:'calculator',name:'Calculatrice',icon:'🧮',type:'builtin'},
 {id:'taskmanager',name:'Gestionnaire des tâches',icon:'📊',type:'builtin'},
 {id:'ruche-settings',name:'Réglages Ruche',icon:'◉',type:'builtin'},
 {id:'ruche-finder',name:'Ruche Finder',icon:'🗂️',type:'builtin'},
 {id:'ruche-control',name:'Centre de contrôle',icon:'🎛️',type:'builtin'},
 {id:'ruche-activity',name:'Activité du PC',icon:'▤',type:'builtin'},
];
function configFile(){return path.join(app.getPath('userData'),'ruche-settings.json')}
function saveSettings(){const target=configFile();fs.mkdirSync(path.dirname(target),{recursive:true});const tmp=target+'.tmp';fs.writeFileSync(tmp,JSON.stringify(settings,null,2),'utf8');fs.renameSync(tmp,target);broadcastSettings()}
function loadSettings(){try{settings=normalizeSettings(defaults,JSON.parse(fs.readFileSync(configFile(),'utf8')))}catch{settings={...defaults}}}
function broadcastSettings(){for(const w of Object.values(windows))if(w&&!w.isDestroyed())w.webContents.send('ruche:settings',settings)}
function emitApps(){for(const w of Object.values(windows))if(w&&!w.isDestroyed())w.webContents.send('ruche:apps',getApps())}
function getApps(){return [...builtins,...installed]}
function make(name,opts){const w=new BrowserWindow({frame:false,transparent:true,backgroundColor:'#00000000',show:false,resizable:['finder','settings','activity','control','search'].includes(name),minimizable:true,maximizable:['finder','settings','activity','control','search'].includes(name),skipTaskbar:true,alwaysOnTop:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true},...opts});w.loadFile(path.join(__dirname,'index.html'),{query:{panel:name}});w.webContents.on('did-finish-load',()=>{w.webContents.send('ruche:apps',getApps());w.webContents.send('ruche:settings',settings)});windows[name]=w;w.on('closed',()=>{if(windows[name]===w)delete windows[name]});return w}
function layout(){const d=screen.getPrimaryDisplay().bounds;const w=screen.getPrimaryDisplay().workArea;return {desktop:{x:d.x,y:d.y,width:d.width,height:d.height},control:{x:d.x+d.width-400,y:d.y+53,width:385,height:500},finder:{x:d.x+Math.floor((d.width-940)/2),y:d.y+Math.floor((d.height-670)/2),width:940,height:670},activity:{x:d.x+Math.floor((d.width-820)/2),y:d.y+Math.floor((d.height-600)/2),width:820,height:600},bar:{x:d.x,y:d.y,width:d.width,height:54},dock:{x:d.x+Math.max(0,Math.floor((d.width-Math.min(740,d.width))/2)),y:d.y+d.height-108,width:Math.min(740,d.width),height:100},launchpad:{x:d.x,y:d.y,width:d.width,height:d.height},search:{x:d.x+Math.floor((d.width-680)/2),y:d.y+Math.floor(d.height*.19),width:680,height:460},settings:{x:d.x+Math.floor((d.width-840)/2),y:d.y+Math.floor((d.height-630)/2),width:840,height:630}}}
function position(){const l=layout();for(const [name,w]of Object.entries(windows)){if(!w.isDestroyed()&&l[name]&&!w.isMaximized()&&!w.isFullScreen())w.setBounds(l[name])}}
function show(name){const w=windows[name];if(!w)return;if(['bar','dock','desktop'].includes(name)&&(settings.companionMode||companion.running))return;position();if(['launchpad','search','settings','control','finder','activity'].includes(name)){for(const k of ['launchpad','search','settings','control','finder','activity'])if(k!==name&&windows[k])windows[k].hide()};w.show();if(name!=='desktop')w.focus();emitApps()}
function toggle(name){const w=windows[name];if(w?.isVisible())w.hide();else show(name)}

function applyCompanion(){
  // Companion mode never takes over the dock, toolbar, or Windows desktop.
  for(const n of ['bar','dock','desktop']){
    const w=windows[n];if(!w||w.isDestroyed())continue;
    if(settings.companionMode||companion.running)w.hide();
    else if(n==='desktop'?!settings.desktopMode:false)w.hide();
    else if(n!=='desktop')w.showInactive();else w.showInactive();
  }
}
async function detectMyDockFinder(){
  if(!WINDOWS)return {running:false,names:[],checkedAt:new Date().toISOString(),supported:false};
  // Name based best-effort detection, not an official MyDockFinder integration API.
  const ps=`Get-Process -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName | ConvertTo-Json -Compress`;
  try{const encoded=Buffer.from(ps,'utf16le').toString('base64');const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{timeout:8000,windowsHide:true,maxBuffer:256*1024});const values=JSON.parse(stdout.trim()||'[]');const names=[...(Array.isArray(values)?values:[values])].filter(processMatch);companion={running:names.length>0,names:[...new Set(names)].slice(0,10),checkedAt:new Date().toISOString(),supported:true};applyCompanion();return companion;}catch{return {running:false,names:[],checkedAt:new Date().toISOString(),supported:false}}
}
function samplePerformance(){
  const now=process.hrtime.bigint();const cpu=process.cpuUsage(previousCpu);const elapsed=Number(now-previousSample)/1000;
  previousCpu=process.cpuUsage();previousSample=now;
  // Electron's main process only; cannot claim whole-computer CPU measurements.
  const percent=elapsed>0?Math.max(0,Math.min(100,100*(cpu.user+cpu.system)/elapsed)):0;
  const memory=Math.round(process.memoryUsage().rss/1024/1024);
  const battery=powerMonitor.isOnBatteryPower();
  const tier=performanceTier(settings.performanceMode,{battery,appCpuPercent:percent,appMemoryMB:memory});
  performance={tier,appMemoryMB:memory,appCpuPercent:Math.round(percent*10)/10,battery,observed:'Processus principal Electron uniquement — pas le PC entier ni MyDockFinder',at:new Date().toISOString()};
  for(const w of Object.values(windows))if(w&&!w.isDestroyed())w.webContents.send('ruche:performance',performance);
  return performance;
}

function validID(s){return typeof s==='string'&&s.length<300}
async function launch(id){if(!validID(id))return false;try{
 if(id==='ruche-settings'){show('settings');return true}
 if(id==='ruche-finder'){show('finder');return true}
 if(id==='ruche-control'){show('control');return true}
 if(id==='ruche-activity'){show('activity');return true}
 if(id==='browser'){await shell.openExternal('https://www.google.com');return true}
 if(id==='settings'){await shell.openExternal('ms-settings:');return true}
 const cmds={explorer:['explorer.exe',[]],terminal:['wt.exe',[]],notepad:['notepad.exe',[]],calculator:['calc.exe',[]],taskmanager:['taskmgr.exe',[]]};
 if(cmds[id]){const [bin,args]=cmds[id];spawn(bin,args,{detached:true,stdio:'ignore',windowsHide:true}).unref();return true}
 const found=installed.find(x=>x.id===id);if(!found)return false;
 if(found.type==='shortcut'&&found.path){const err=await shell.openPath(found.path);return err==='' }
 return false;
 }catch(e){console.error('Launch failed:',String(e));return false}}
async function discover(){if(!WINDOWS){installed=[];emitApps();return}
 // Only discover shortcuts in the standard Start Menu paths. No recursive unrestricted filesystem access.
 const ps=`$dirs=@([Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'));$links=foreach($d in $dirs){if(Test-Path -LiteralPath $d){Get-ChildItem -LiteralPath $d -Filter '*.lnk' -Recurse -File -ErrorAction SilentlyContinue|Select-Object -First 250 FullName,BaseName}};$links|ConvertTo-Json -Compress -Depth 3`;
 try{const encoded=Buffer.from(ps,'utf16le').toString('base64');const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{windowsHide:true,timeout:10000,maxBuffer:1024*1024});const raw=stdout.trim();const data=raw?JSON.parse(raw):[];const unique=new Map();for(const x of (Array.isArray(data)?data:[data])){if(!x?.FullName||!x.BaseName)continue;const id='lnk:'+Buffer.from(x.FullName,'utf8').toString('base64url');if(!unique.has(x.BaseName))unique.set(x.BaseName,{id,name:String(x.BaseName).slice(0,80),path:x.FullName,type:'shortcut',icon:'◈'})}installed=Array.from(unique.values()).slice(0,250).sort((a,b)=>a.name.localeCompare(b.name,'fr'));emitApps()}catch(e){console.error('Start Menu scan:',String(e))}}
async function queryActivity(){
 if(!WINDOWS)return [];
 try{
  const ps=`Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -and $_.MainWindowTitle.Trim() } | Select-Object -First 75 Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress`;
  const enc=Buffer.from(ps,'utf16le').toString('base64');
  const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',enc],{timeout:7500,windowsHide:true,maxBuffer:512*1024});
  const rows=JSON.parse(stdout.trim()||'[]');
  return (Array.isArray(rows)?rows:[rows]).filter(x=>validWindowTarget(Number(x.Id))).map(x=>({pid:Number(x.Id),name:String(x.ProcessName).slice(0,80),title:String(x.MainWindowTitle).slice(0,150)}));
 }catch{return []}
}
function setupIPC(){ipcMain.handle('ruche:companion-status',()=>companion);ipcMain.handle('ruche:companion-refresh',detectMyDockFinder);ipcMain.handle('ruche:performance',()=>samplePerformance());ipcMain.handle('ruche:window-state',event=>{const w=BrowserWindow.fromWebContents(event.sender);return w?{maximized:w.isMaximized(),fullscreen:w.isFullScreen(),minimized:w.isMinimized(),resizable:w.isResizable()}:null});ipcMain.handle('ruche:window-control',(event,cmd)=>{const w=BrowserWindow.fromWebContents(event.sender);if(!w||!Object.values(windows).includes(w)||!['close','minimize','maximize','fullscreen'].includes(cmd))return false;if(cmd==='close')w.hide();if(cmd==='minimize'&&w.isMinimizable())w.minimize();if(cmd==='maximize'&&w.isMaximizable()){if(w.isMaximized())w.unmaximize();else w.maximize()}if(cmd==='fullscreen'&&w.isMaximizable()){w.setFullScreen(!w.isFullScreen())}return {ok:true,maximized:w.isMaximized(),fullscreen:w.isFullScreen()}});ipcMain.handle('ruche:app-list',()=>getApps());ipcMain.handle('ruche:launch',async(_e,id)=>{const ok=await launch(id);if(ok){windows.launchpad?.hide();windows.search?.hide()}return ok});ipcMain.handle('ruche:settings-get',()=>settings);ipcMain.handle('ruche:app-icon',async(_e,id)=>{if(!validID(id)||!id.startsWith('lnk:'))return null;const found=installed.find(x=>x.id===id);if(!found)return null;if(iconCache.has(id))return iconCache.get(id);try{const img=await app.getFileIcon(found.path,{size:'large'});const data=img.toDataURL();iconCache.set(id,data);return data}catch{return null}});
 ipcMain.handle('ruche:settings-set',(_e,patch)=>{if(!patch||typeof patch!=='object')return settings;const next={...settings};if(typeof patch.theme==='string'&&['light','dark'].includes(patch.theme))next.theme=patch.theme;if(['aurora','midnight','dawn'].includes(patch.wallpaper))next.wallpaper=patch.wallpaper;if(typeof patch.desktopMode==='boolean')next.desktopMode=patch.desktopMode;if(typeof patch.companionMode==='boolean')next.companionMode=patch.companionMode;if(['adaptive','balanced','quality'].includes(patch.performanceMode))next.performanceMode=patch.performanceMode;if(typeof patch.reduceMotion==='boolean')next.reduceMotion=patch.reduceMotion;if(typeof patch.accent==='string'&&/^#[\da-fA-F]{6}$/.test(patch.accent))next.accent=patch.accent;if(typeof patch.glass==='number')next.glass=Math.max(.5,Math.min(.98,patch.glass));if(Array.isArray(patch.pinned))next.pinned=patch.pinned.filter(validID).slice(0,12);settings=next;nativeTheme.themeSource=settings.theme;saveSettings();applyCompanion();if(windows.desktop)settings.desktopMode&&!settings.companionMode&&!companion.running?windows.desktop.showInactive():windows.desktop.hide();samplePerformance();return settings});
 ipcMain.handle('ruche:open-control',()=>{toggle('control');return true});ipcMain.handle('ruche:open-finder',()=>{toggle('finder');return true});ipcMain.handle('ruche:open-activity',()=>{toggle('activity');return true});ipcMain.handle('ruche:open-launchpad',()=>{toggle('launchpad');return true});ipcMain.handle('ruche:open-search',()=>{toggle('search');return true});ipcMain.handle('ruche:open-settings',()=>{show('settings');return true});ipcMain.handle('ruche:show',(_e,name)=>{if(['bar','dock','launchpad','search','settings','control','finder','activity','desktop'].includes(name)){show(name);return true}return false});ipcMain.handle('ruche:hide',(_e,name)=>{if(['launchpad','search','settings','control','finder','activity'].includes(name)){windows[name]?.hide();return true}return false});ipcMain.handle('ruche:quit',()=>{app.quit();return true});ipcMain.handle('ruche:minimize-windows',()=>{windows.launchpad?.hide();windows.search?.hide();windows.settings?.hide();windows.control?.hide();windows.finder?.hide();windows.activity?.hide();return true});ipcMain.handle('ruche:open-folder',(_e,folder)=>{if(folder==='home'){shell.openPath(app.getPath('home'));return true}return false});
 ipcMain.handle('ruche:files',async(_e,relative='')=>{try{return await finderService.list(relative)}catch(e){return {error:String(e.message)}}});
 ipcMain.handle('ruche:file-open',async(_e,relative)=>{try{return (await shell.openPath(await finderService.resolve(relative)))===''}catch{return false}});
 ipcMain.handle('ruche:file-preview',async(_e,relative)=>{try{return await finderService.preview(relative)}catch(e){return {error:String(e.message)}}});
 ipcMain.handle('ruche:finder-operation',async(_e,op,args)=>{try{if(!args||typeof args!=='object')throw Error('Paramètres invalides');if(op==='mkdir')return {ok:await finderService.createFolder(args.dir,args.name)};if(op==='rename')return {ok:await finderService.rename(args.path,args.name)};if(op==='move')return {ok:await finderService.move(args.path,args.dir)};if(op==='copy')return {ok:await finderService.move(args.path,args.dir,true)};if(op==='trash')return {ok:await finderService.trash(args.path)};throw Error('Opération inconnue')}catch(e){return {ok:false,error:String(e.message)}}});
 ipcMain.handle('ruche:activity-list',queryActivity);
 ipcMain.handle('ruche:window-focus',async(_e,pid)=>{
   if(!WINDOWS||!validWindowTarget(pid))return {ok:false,error:'PID invalide'};
   // Validate against the current list of visible top-level processes, never accept executable paths or commands.
   const current=await queryActivity();
   if(!current.some(item=>item.pid===pid))return {ok:false,error:'Fenêtre introuvable'};
   const ps=`$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if(-not $p -or $p.MainWindowHandle -eq 0){exit 3}; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class RucheWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'; [RucheWindow]::ShowWindowAsync($p.MainWindowHandle,9)|Out-Null; if([RucheWindow]::SetForegroundWindow($p.MainWindowHandle)){Write-Output 'OK'}else{Write-Output 'FOCUS_DENIED'}`;
   try{const encoded=Buffer.from(ps,'utf16le').toString('base64');const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{timeout:5500,windowsHide:true,maxBuffer:16384});return {ok:stdout.includes('OK'),error:stdout.includes('OK')?null:'Windows a refusé le changement de focus'}}catch{return {ok:false,error:'Activation de fenêtre indisponible'}}
 });
 ipcMain.handle('ruche:open-windows-settings',(_e,section)=>{const targets={wifi:'ms-settings:network-wifi',bluetooth:'ms-settings:bluetooth',sound:'ms-settings:sound',display:'ms-settings:display',battery:'ms-settings:powersleep',notifications:'ms-settings:notifications',personalization:'ms-settings:personalization'};if(!Object.hasOwn(targets,section))return false;shell.openExternal(targets[section]);return true});
 ipcMain.handle('ruche:system-info',()=>({platform:process.platform,version:process.getSystemVersion(),screens:screen.getAllDisplays().length,onBattery:powerMonitor.isOnBatteryPower(),appVersion:app.getVersion()}));
 }
if(!app.requestSingleInstanceLock()){app.quit()}else{
 app.on('second-instance',()=>{show('search')});
 app.whenReady().then(async()=>{finderService=new FinderService(app.getPath('home'),{trashItem:p=>shell.trashItem(p)});loadSettings();nativeTheme.themeSource=settings.theme;setupIPC();const l=layout();for(const n of ['desktop','bar','dock','launchpad','search','settings','control','finder','activity'])make(n,{...l[n],alwaysOnTop:['bar','dock','search','control'].includes(n)});applyCompanion();screen.on('display-metrics-changed',position);screen.on('display-added',position);screen.on('display-removed',position);globalShortcut.register('Control+Alt+Space',()=>toggle('search'));globalShortcut.register('Control+Alt+L',()=>toggle('launchpad'));globalShortcut.register('Control+Alt+F',()=>toggle('finder'));globalShortcut.register('Control+Alt+Tab',()=>toggle('activity'));globalShortcut.register('Control+Alt+Escape',()=>app.quit());
 const icon=nativeImage.createFromPath(path.join(__dirname,'ruche-tray.png'));tray=new Tray(icon);tray.setToolTip('Ruche OS Desktop — Ctrl+Alt+Échap pour quitter');tray.setContextMenu(Menu.buildFromTemplate([{label:'Ruche Finder',click:()=>show('finder')},{label:'Recherche',click:()=>show('search')},{label:'Réglages Ruche',click:()=>show('settings')},{type:'separator'},{label:'Revenir à Windows — Quitter Ruche',click:()=>app.quit()}]));await discover();await detectMyDockFinder();samplePerformance();sampleTimer=setInterval(()=>{samplePerformance();detectMyDockFinder().catch(()=>{})},30000);sampleTimer.unref?.()});
 app.on('will-quit',()=>{if(sampleTimer)clearInterval(sampleTimer);globalShortcut.unregisterAll()});app.on('window-all-closed',()=>{});
}
