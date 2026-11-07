'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {FinderService,validRelative,within}=require('../src/finder-service.cjs');
test('relative path validation denies traversal and absolute paths',()=>{
 assert.equal(validRelative('../outside'),false);assert.equal(validRelative('x/../y'),false);assert.equal(validRelative('/etc/passwd'),false);assert.equal(validRelative('Docs/file.txt'),true);
 assert.equal(within('/home/example','/home/example2'),false);assert.equal(within('/home/example','/home/example/a'),true);
});
test('Finder create, rename, copy, move, preview and recycle',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ruche-finder-test-'));const home=path.join(temp,'home');const trash=[];
 try{await fs.mkdir(home);await fs.mkdir(path.join(home,'Documents'));await fs.writeFile(path.join(home,'note.txt'),'Bonjour Ruche');const svc=new FinderService(home,{trashItem:async p=>trash.push(p)});
 assert.equal((await svc.list()).entries.length,2);assert.equal((await svc.preview('note.txt')).data,'Bonjour Ruche');await svc.createFolder('','Projets');await svc.rename('note.txt','notes.md');assert.equal((await svc.preview('notes.md')).kind,'text');await svc.move('notes.md','Documents',true);assert.equal((await svc.preview('Documents/notes.md')).data,'Bonjour Ruche');await svc.move('notes.md','Projets');assert.equal((await svc.preview('Projets/notes.md')).data,'Bonjour Ruche');await svc.trash('Projets/notes.md');assert.equal(trash.length,1);await assert.rejects(()=>svc.move('Projets','Projets',true));await assert.rejects(()=>svc.createFolder('','../illegal'));
 }finally{await fs.rm(temp,{recursive:true,force:true})}
});
test('Finder rejects symlink escape, home deletion and overwrites',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ruche-finder-security-'));const home=path.join(temp,'home'),external=path.join(temp,'outside');
 try{await fs.mkdir(home);await fs.mkdir(external);await fs.writeFile(path.join(home,'a.txt'),'a');await fs.writeFile(path.join(home,'b.txt'),'b');await fs.writeFile(path.join(external,'secret.txt'),'secret');const svc=new FinderService(home,{trashItem:async()=>{}});
 await assert.rejects(()=>svc.trash(''));await assert.rejects(()=>svc.rename('a.txt','b.txt'));await assert.rejects(()=>svc.resolve('../outside/secret.txt'));
 try{await fs.symlink(external,path.join(home,'external'),'dir');await assert.rejects(()=>svc.resolve('external/secret.txt'));}catch(e){if(!['EPERM','EACCES','ENOTSUP'].includes(e.code))throw e}
 }finally{await fs.rm(temp,{recursive:true,force:true})}
});
