'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
test('les boutons Mac utilisent le contrôleur de fenêtre principal, sans croix concurrente',()=>{
 const ui=load('ui.js');
 const center=ui.slice(ui.indexOf('function controlCenter(){'),ui.indexOf('let quickLookOpen=false;'));
 assert.match(ui,/function chrome\(title,kind\)/);
 assert.match(ui,/window-control/);
 assert.doesNotMatch(center,/round-close/);
 assert.match(center,/chrome\('Centre de contrôle'/);
});
test('commandes systèmes autorisées, limitées et déclarées par le preload',()=>{
 const main=load('main.cjs'),preload=load('preload.cjs');
 assert.match(main,/const actions=\['volume-up','volume-down','volume-mute','brightness-up','brightness-down'\]/);
 assert.match(main,/ipcMain.handle\('ruche:system-control'/);
 assert.match(preload,/'system-control'/);
 assert.match(main,/windowsHide:true,timeout:5500/);
});
test('diagnostic des anciens habillages en lecture seule et sur action volontaire',()=>{
 const main=load('main.cjs'),ui=load('ui.js'),preload=load('preload.cjs');
 assert.match(main,/async function legacyInterfaceScan\(/);
 assert.match(main,/Get-StartApps/);
 assert.match(main,/Get-CimInstance Win32_Process/);
 assert.match(preload,/'legacy-scan'/);
 assert.match(ui,/Retrouver les anciens Docks et interfaces/);
 assert.doesNotMatch(main.slice(main.indexOf('async function legacyInterfaceScan()'),main.indexOf('async function systemControl(')),/Remove-Item|Stop-Process|Uninstall-/);
});
