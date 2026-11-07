'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
test('native Windows window decorations are disabled in the Electron host',()=>{
 const main=source('main.cjs');
 assert.match(main,/new BrowserWindow\(\{frame:false,transparent:true/);
 assert.match(main,/contextIsolation:true,nodeIntegration:false,sandbox:true/);
 assert.match(main,/ruche:window-control/);
 assert.match(main,/w\.setFullScreen\(!w\.isFullScreen\(\)\)/);
});
test('single Mac-like titlebar with functional red yellow green controls',()=>{
 const ui=source('ui.js');
 assert.match(ui,/function chrome\(title,kind\)/);
 assert.match(ui,/\['red','Fermer cette fenêtre','close'/);
 assert.match(ui,/\['yellow','Réduire dans la barre des tâches','minimize'/);
 assert.match(ui,/\['green','Zoomer ou restaurer \(Alt : plein écran\)','maximize'/);
 assert.match(ui,/ondblclick:e=>/);
 assert.match(ui,/s\.append\(chrome\('Réglages','settings'\)/);
});
test('Finder opens a bounded overlay and offers native file access',()=>{
 const ui=source('ui.js');
 assert.match(ui,/function showQuickLook\(entry\)/);
 assert.match(ui,/role:'dialog','aria-modal':'true'/);
 assert.match(ui,/action\('file-preview',entry\.relative\)/);
 assert.match(ui,/action\('file-open',entry\.relative\)/);
});
