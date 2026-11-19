import {seedFor} from "./sandbox.mjs";

export const encounterCap=2;
export const encounterZones=Object.freeze([
 {id:"market",x:-12,z:-7,spots:[[-31,0],[-26,9],[5,11]]},
 {id:"road",x:19,z:5,spots:[[8,16],[35,9],[32,-8]]},
 {id:"clinic",x:48,z:0,spots:[[34,13],[68,8],[65,-10]]}
]);
export const encounterTypes=["walker","runner"];

export function planEncounter(seed,zone,eligible){
 const offset=seedFor(seed,zone.id)%zone.spots.length;
 for(let i=0;i<zone.spots.length;i++){
  const [x,z]=zone.spots[(offset+i)%zone.spots.length];
  const count=1+seedFor(seed,zone.id+"-count")%encounterCap;
  const group=Array.from({length:count},(_,index)=>({x:x+index*1.9,z:z+index*1.3,type:encounterTypes[index]}));
  if(group.every(eligible))return group;
 }
 return [];
}

export function keepEncounter(actor,player){
 return (actor.x-player.x)**2+(actor.z-player.z)**2<=56**2;
}
