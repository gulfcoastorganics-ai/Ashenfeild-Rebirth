/**
 * Pure 2D collision/navigation helpers for Ashford Rebirth.
 * Zero dependencies, deterministic, and testable in Node.
 */
export const WORLD_LIMITS=Object.freeze({minX:-74,maxX:74,minZ:-55,maxZ:44});
export const ENTRANCES=Object.freeze([
 {left:-61.5,right:-36.5,back:-37.5,front:-14.5,door:-47},
 {left:-24,right:2,back:-38,front:-14,door:-11},
 {left:29.5,right:60.5,back:-39,front:-13,door:44}
]);
export function isBlocked(x,z,r=.3,obstacles=[],bounds=WORLD_LIMITS){
 if(x<bounds.minX+r||x>bounds.maxX-r||z<bounds.minZ+r||z>bounds.maxZ-r)return true;
 for(const o of obstacles){
  if(x+r>o.x-o.w/2&&x-r<o.x+o.w/2&&z+r>o.z-o.d/2&&z-r<o.z+o.d/2)return true;
 }
 return false;
}
export function lineBlocked(x1,z1,x2,z2,r=.1,obstacles=[],bounds=WORLD_LIMITS){
 const length=Math.hypot(x2-x1,z2-z1);
 const steps=Math.max(1,Math.ceil(length/.35));
 // Allow close-quarters hit detection, but reject any wall crossed by the centerline.
 for(let i=1;i<steps;i++){
  const t=i/steps;
  if(isBlocked(x1+(x2-x1)*t,z1+(z2-z1)*t,r,obstacles,bounds))return true;
 }
 return false;
}
export function chaseGoal(enemy,target,entrances=ENTRANCES){
 for(const entry of entrances){
  const playerInside=target.x>entry.left+1&&target.x<entry.right-1&&target.z<entry.front-1&&target.z>entry.back+.8;
  const enemyOutside=enemy.z>entry.front-.5||enemy.x<entry.left+.5||enemy.x>entry.right-.5;
  if(playerInside&&enemyOutside){
   if(enemy.z>entry.front+3.5||Math.abs(enemy.x-entry.door)>2.3)
    return {x:entry.door,z:entry.front+2.3};
   return {x:entry.door,z:entry.front-3.2};
  }
 }
 return target;
}
export function clampFinite(value,min,max,fallback){
 return typeof value==="number"&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
}
export function restoreCheckpoint(saved,current){
 if(!saved||typeof saved!=="object")return {...current};
 const s={...current};
 s.stage=Math.round(clampFinite(saved.stage,0,8,current.stage));
 s.x=clampFinite(saved.x,WORLD_LIMITS.minX+1,WORLD_LIMITS.maxX-1,current.x);
 s.z=clampFinite(saved.z,WORLD_LIMITS.minZ+1,WORLD_LIMITS.maxZ-1,current.z);
 for(const name of ["health","stamina","thirst","hunger"])s[name]=clampFinite(saved[name],0,100,current[name]);
 s.ammo=Math.round(clampFinite(saved.ammo,0,999,current.ammo));
 s.kills=Math.round(clampFinite(saved.kills,0,9999,current.kills));
 s.waveKills=Math.round(clampFinite(saved.waveKills,0,3,current.waveKills));
 s.hasGun=Boolean(saved.hasGun);
 s.supplies=Math.round(clampFinite(saved.supplies,0,1,current.supplies));
 const inv=saved.inventory&&typeof saved.inventory==="object"?saved.inventory:{};
 s.inventory={...current.inventory};
 for(const name of ["water","food","bandage"])s.inventory[name]=Math.round(clampFinite(inv[name],0,99,current.inventory[name]));
 // A saved location inside a building wall is never a safe spawn.
 if(isBlocked(s.x,s.z,.35,[])) {s.x=current.x;s.z=current.z;}
 return s;
}
