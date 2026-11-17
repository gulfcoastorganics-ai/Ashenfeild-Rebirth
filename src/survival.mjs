/**
 * V0.6 player skill and local performance helpers.
 * No rendering state or browser globals; all helpers deterministic.
 */
export const DODGE = Object.freeze({cost:22,duration:.32,invulnerability:.24,cooldown:1.1,speed:12.5});
export function canDodge(stamina,cooldown,active){
 return Number.isFinite(stamina)&&stamina>=DODGE.cost&&(!Number.isFinite(cooldown)||cooldown<=0)&&!active;
}
export function normalize2D(x,z,fallback={x:0,z:1}){
 const len=Math.hypot(x,z);
 if(!Number.isFinite(len)||len<.001)return {...fallback};
 return {x:x/len,z:z/len};
}
export function summarizeFrames(frameMs){
 const samples=frameMs.filter(x=>Number.isFinite(x)&&x>0&&x<10000).sort((a,b)=>a-b);
 const n=samples.length;
 if(!n)return {samples:0,fps:0,meanMs:0,p50Ms:0,p95Ms:0};
 const meanMs=samples.reduce((a,b)=>a+b,0)/n;
 return {samples:n,fps:Math.round((1000/meanMs)*10)/10,
  meanMs:Math.round(meanMs*10)/10,
  p50Ms:Math.round(samples[Math.floor(n*.50)]*10)/10,
  p95Ms:Math.round(samples[Math.min(n-1,Math.ceil(n*.95)-1)]*10)/10};
}
