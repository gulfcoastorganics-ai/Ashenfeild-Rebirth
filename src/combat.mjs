/**
 * Ashford Rebirth V0.5 deterministic combat rules.
 * Fictional game-system calculations only; independent of rendering and input.
 */
import {lineBlocked} from "./nav.mjs";

export const WEAPONS=Object.freeze({
 crowbar:Object.freeze({damage:55,range:2.9,minAimDot:.35,cooldown:.56}),
 pistol:Object.freeze({damage:68,range:26,minAimDot:.945,cooldown:.29})
});
export const INFECTED=Object.freeze({
 walker:Object.freeze({health:75,speed:2.25,meleeDamage:12,meleeCooldown:1.5,meleeWindup:.48}),
 runner:Object.freeze({health:52,speed:4.25,meleeDamage:9,meleeCooldown:.9,meleeWindup:.25}),
 brute:Object.freeze({health:175,speed:1.6,meleeDamage:23,meleeCooldown:2.25,meleeWindup:.95}),
 spitter:Object.freeze({health:75,speed:1.9,meleeDamage:8,meleeCooldown:1.8,meleeWindup:.5,rangedDamage:10,rangedCooldown:3.4,rangedWindup:.8})
});
export const ATTACK_RANGE=1.65;
export const SPIT_RANGE=13;

/** Returns the nearest valid enemy while favoring those near the aiming axis.
 * Works with plain objects {x,z,dead,hp}; side effects forbidden. */
export function chooseTarget(origin,facing,enemies,weapon,obstacles=[],maxAimOverride=null){
 const spec=typeof weapon==="string"?WEAPONS[weapon]:weapon;
 if(!spec||!Number.isFinite(origin.x)||!Number.isFinite(origin.z))return null;
 const fl=Math.hypot(facing.x,facing.z);
 if(fl<.1)return null;
 let best=null,bestScore=-Infinity;
 for(const e of enemies){
  if(e.dead||e.hp<=0)continue;
  const dx=e.x-origin.x,dz=e.z-origin.z,range=Math.hypot(dx,dz);
  if(range>.01&&range<=spec.range){
   const aim=(dx*facing.x+dz*facing.z)/(range*fl);
   if(aim<(maxAimOverride??spec.minAimDot))continue;
   if(lineBlocked(origin.x,origin.z,e.x,e.z,.12,obstacles))continue;
   const score=aim*2-range/spec.range*.55;
   if(score>bestScore){best=e;bestScore=score;}
  }
 }
 return best;
}
export function applyHit(health,damage){
 const hp=Math.max(0,Number.isFinite(health)?health:0);
 const dmg=Math.max(0,Number.isFinite(damage)?damage:0);
 const after=Math.max(0,hp-dmg);
 return Object.freeze({health:after,damage:hp-after,killed:hp>0&&after===0});
}
/** Distinct, readable infected attacks; actual damage resolves after telegraph. */
export function chooseInfectedAction(type,distance,hasLineOfSight=true){
 if(!Number.isFinite(distance)||distance<0||!hasLineOfSight)return null;
 const spec=INFECTED[type];if(!spec)return null;
 if(type==="spitter"&&distance>2.4&&distance<=SPIT_RANGE)
  return Object.freeze({kind:"spit",windup:spec.rangedWindup,cooldown:spec.rangedCooldown,damage:spec.rangedDamage,range:SPIT_RANGE});
 if(distance<=ATTACK_RANGE)
  return Object.freeze({kind:"melee",windup:spec.meleeWindup,cooldown:spec.meleeCooldown,damage:spec.meleeDamage,range:ATTACK_RANGE});
 return null;
}
/** A dodge or retreat can invalidate the attack during its windup. */
export function attackStillValid(intent,distance,hasLineOfSight=true){
 if(!intent||!hasLineOfSight||!Number.isFinite(distance))return false;
 return distance<=intent.range&&distance>=0&&(intent.kind!=="spit"||distance>2.4);
}
