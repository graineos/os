// Small, platform-independent Ruche Desktop validation helpers.
'use strict';
const HEX=/^#[0-9a-fA-F]{6}$/;
function validWindowTarget(pid){return Number.isSafeInteger(pid)&&pid>0&&pid<=4294967295}
function normalizeSettings(defaults,user){
 const result={...defaults};
 if(!user||typeof user!=='object'||Array.isArray(user))return result;
 if(user.theme==='light'||user.theme==='dark')result.theme=user.theme;
 if(['aurora','midnight','dawn'].includes(user.wallpaper))result.wallpaper=user.wallpaper;
 if(typeof user.accent==='string'&&HEX.test(user.accent))result.accent=user.accent;
 if(typeof user.glass==='number'&&Number.isFinite(user.glass))result.glass=Math.max(.5,Math.min(.98,user.glass));
 for(const key of ['desktopMode','reduceMotion','companionMode'])if(typeof user[key]==='boolean')result[key]=user[key];
 if(['adaptive','balanced','quality'].includes(user.performanceMode))result.performanceMode=user.performanceMode;
 if(Array.isArray(user.pinned))result.pinned=[...new Set(user.pinned.filter(x=>typeof x==='string'&&x.length>0&&x.length<300))].slice(0,12);
 return result;
}
function processMatch(name){return typeof name==='string'&&/^(mydockfinder|mydock|myfinder)$/i.test(name.trim())}
function performanceTier(mode,{battery=false,appCpuPercent=0,appMemoryMB=0}={}){
 if(mode==='balanced')return 'balanced';
 if(mode==='quality')return 'quality';
 return battery||appCpuPercent>18||appMemoryMB>350?'balanced':'quality';
}
module.exports={validWindowTarget,normalizeSettings,processMatch,performanceTier};
